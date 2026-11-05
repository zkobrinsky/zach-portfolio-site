"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BASE_FOV, ORBIT_NEAR, POV_FOV, POV_NEAR, VIEW_UP } from "@/lib/space/constants";
import { MOONS, type MoonSpec } from "@/lib/space/moons";
import { shipPosition } from "@/lib/space/ship";
import { space } from "@/lib/space/state";
import { ASTRONAUT_HEIGHT } from "./Astronaut";

/*
  The trip from orbit to a page, in order:

    flyIn     the camera flies into the helmet (CameraRig does this part)
    lookDown  the astronaut straightens out feet-first, and the camera drops to frame just the boots
    dive      astronaut and camera fall to the moon
    impact    a hard stop and a jolt, then the screen cuts to black
    landed    the astronaut is out cold. Behind the black, a normal web page takes over, and
              SpaceExperience plays the gasp and the eyes opening.
    approach  (ship only) first-person flight to the spaceship, fading to black at the hull
    boarded   (ship only) fades up inside the ship
    leave     going back: the page fades to black
    climb     the view fades up on the moon's surface and the camera flies back up to orbit

  Scale trick: the astronaut is bigger than a moon's radius at scene scale, so during the dive the
  astronaut and the camera shrink together. The boots stay the same size on screen while the moon
  grows into a whole world.
*/
const LOOK_DOWN_SECONDS = 1.5;
const DIVE_SECONDS = 2.7;
/** How much the fall eases off just before touchdown, to get a moment with the moon up close. 1 is no easing. */
const DIVE_END_EASE = 2;
const IMPACT_SECONDS = 0.16;
const FADE_TO_BLACK_SECONDS = 0.5;
const CLIMB_SECONDS = 3.6;
const FADE_FROM_BLACK_SECONDS = 0.9;
const SHAKE_SECONDS = 0.5;

/** The trip to the ship: fly over, fade out at the hull, fade in aboard. */
const APPROACH_SECONDS = 3.6;
const BOARDED_FADE_SECONDS = 1.2;
/** How far from the ship's center the flight ends. */
const SHIP_STOP = 0.24;
/** The flight curves out to at least this far from the planet's center. */
const CLEAR_OF_PLANET = 3.2;
/** How hard the landing jolts the camera. 0 turns the shake off. */
const SHAKE_STRENGTH = 0.05;

/** The astronaut's height on the moon's surface, as a fraction of the moon's radius. */
const LANDED_HEIGHT = 0.06;

/** Where the camera sits relative to the boots, in astronaut heights. */
const CAMERA_ABOVE_FEET = 0.34;
const CAMERA_AHEAD_OF_FEET = 0.2;
const LOOK_AHEAD_OF_FEET = 0.075;
const SOLE_BELOW_FOOT_BONE = 0.035;

type Phase = "idle" | "flyIn" | "lookDown" | "dive" | "impact" | "approach" | "boarded" | "landed" | "leave" | "climb";

export type LandingEvents = {
  /** The boots just hit the ground. */
  onImpact: () => void;
  /** The screen is black. Swap the page now (null: back to space). */
  onCovered: (moonId: string | null) => void;
  onBackInOrbit: () => void;
};

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

const feetWorld = new THREE.Vector3();
const shipAt = new THREE.Vector3();
const footA = new THREE.Vector3();
const up = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const cameraGoal = new THREE.Vector3();
const lookGoal = new THREE.Vector3();
const rotationGoal = new THREE.Quaternion();
const lookMatrix = new THREE.Matrix4();
const scratch = new THREE.Vector3();
const scratchRotation = new THREE.Quaternion();

/** Where the camera should be to frame the boots, for the astronaut's current pose. */
/** Aboard the ship: the astronaut floats at the center, off to one side of the about text on wide screens. */
function poseInShip(astronaut: THREE.Object3D, camera: THREE.PerspectiveCamera, aspect: number) {
  const t = space.time;
  const wide = aspect > 1.1;
  space.inShip = true;
  space.flailAmount = 1;
  astronaut.visible = space.headOn; // stays hidden until the head has loaded, so the helmet never shows
  astronaut.scale.setScalar(1);
  astronaut.position.set(0, Math.sin(t * 0.5) * 0.008, 0);
  astronaut.rotation.set(0.04 * Math.sin(t * 0.3), 0.3 + 0.08 * Math.sin(t * 0.2), 0.03 * Math.sin(t * 0.25));
  // a close crop on the head and chest: to the left of the text on wide screens, above it on narrow ones
  camera.position.set(wide ? 0.13 : 0, 0.17, wide ? 0.62 : 0.72);
  camera.lookAt(wide ? 0.13 : 0, wide ? 0.15 : 0.1, 0);
}

function frameBoots(astronaut: THREE.Object3D, scale: number) {
  if (!space.feet) return;
  astronaut.updateMatrixWorld(true);
  space.feet[0].getWorldPosition(feetWorld);
  space.feet[1].getWorldPosition(footA);
  feetWorld.add(footA).multiplyScalar(0.5);
  up.set(0, 1, 0).transformDirection(astronaut.matrixWorld);
  forward.set(0, 0, 1).transformDirection(astronaut.matrixWorld);
  const size = ASTRONAUT_HEIGHT * scale;
  cameraGoal.copy(feetWorld).addScaledVector(up, size * CAMERA_ABOVE_FEET).addScaledVector(forward, size * CAMERA_AHEAD_OF_FEET);
  lookGoal.copy(feetWorld).addScaledVector(forward, size * LOOK_AHEAD_OF_FEET);
  // toes point up the screen, so the legs come in from the bottom edge, like looking down at your own feet
  rotationGoal.setFromRotationMatrix(lookMatrix.lookAt(cameraGoal, lookGoal, forward));
}

type Props = LandingEvents & { destination: string | null; startedOnPage: boolean };

export function LandingSequence({ destination, startedOnPage, onImpact, onCovered, onBackInOrbit }: Props) {
  const trip = useRef({
    phase: "idle" as Phase,
    startedAt: 0,
    moon: null as MoonSpec | null,
    startCamera: new THREE.Vector3(),
    startRotation: new THREE.Quaternion(),
    startAstronautRotation: new THREE.Quaternion(),
    alignedRotation: new THREE.Quaternion(),
    startPosition: new THREE.Vector3(),
    feetOffset: new THREE.Vector3(),
    touchdown: new THREE.Vector3(),
    surfaceNormal: new THREE.Vector3(),
    landedScale: 1,
    landedCamera: new THREE.Vector3(),
    landedCameraRotation: new THREE.Quaternion(),
    control: new THREE.Vector3(),
  });
  const events = useRef({ onImpact, onCovered, onBackInOrbit });
  useEffect(() => {
    events.current = { onImpact, onCovered, onBackInOrbit };
  }, [onImpact, onCovered, onBackInOrbit]);

  /** Records a moon as the one we're standing on, for when the camera flies back up from it. */
  const standOn = (moon: MoonSpec) => {
    const t = trip.current;
    t.moon = moon;
    if (moon.ship) {
      // going back starts just outside the hull
      shipPosition(space.time, shipAt);
      t.landedScale = 0.5;
      t.landedCamera.copy(space.orbitPosition).sub(shipAt).normalize().multiplyScalar(SHIP_STOP).add(shipAt);
      t.landedCameraRotation.setFromRotationMatrix(lookMatrix.lookAt(t.landedCamera, shipAt, up.set(0, 1, 0)));
      return;
    }
    t.landedScale = (moon.radius * LANDED_HEIGHT) / ASTRONAUT_HEIGHT;
    t.surfaceNormal.copy(space.orbitPosition).sub(moon.position).normalize();
    t.landedCamera.copy(moon.position).addScaledVector(t.surfaceNormal, moon.radius * 1.02);
    t.landedCameraRotation.setFromRotationMatrix(lookMatrix.lookAt(t.landedCamera, moon.position, up.set(0, 1, 0)));
  };

  // opened straight on a page: set everything up as if the trip had already happened
  useLayoutEffect(() => {
    const t = trip.current;
    const moon = MOONS.find(({ id }) => id === destination);
    if (!startedOnPage || !moon || t.phase !== "idle") return;
    standOn(moon);
    t.phase = "landed";
    space.cameraOwner = "landing";
    space.astronautHeld = true;
    space.worldHidden = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the page the visit started on
  }, []);

  const wanted = useRef(destination);
  useEffect(() => {
    wanted.current = destination;
    const t = trip.current;
    if (destination && t.phase === "idle") {
      t.moon = MOONS.find((moon) => moon.id === destination) ?? null;
      if (t.moon) t.phase = "flyIn";
    } else if (destination && t.phase === "landed" && t.moon?.id !== destination) {
      // switched pages without leaving the ground
      const moon = MOONS.find(({ id }) => id === destination);
      if (moon) standOn(moon);
    } else if (!destination && t.phase === "landed") {
      t.phase = "leave";
      t.startedAt = performance.now();
    }
  }, [destination]);

  useFrame(({ camera, size }) => {
    const t = trip.current;
    const astronaut = space.astronaut;
    if (t.phase === "idle" || !astronaut || !t.moon) return;
    const perspective = camera as THREE.PerspectiveCamera;
    const now = performance.now();
    const seconds = (now - t.startedAt) / 1000;
    const begin = (phase: Phase) => {
      t.phase = phase;
      t.startedAt = now;
    };
    const lens = (fov: number, near: number) => {
      perspective.fov = fov;
      perspective.near = near;
      perspective.updateProjectionMatrix();
    };

    switch (t.phase) {
      case "flyIn": {
        if (space.flightMix < 1 || !space.head) return;
        if (t.moon.ship) {
          t.startCamera.copy(perspective.position);
          t.startRotation.copy(perspective.quaternion);
          shipPosition(space.time, shipAt);
          t.startPosition.copy(t.startCamera).sub(shipAt).normalize().multiplyScalar(SHIP_STOP).add(shipAt);
          // bow the path out around the planet
          t.control.copy(t.startCamera).add(t.startPosition).multiplyScalar(0.5);
          if (t.control.lengthSq() < 1e-4) t.control.copy(VIEW_UP);
          if (t.control.length() < CLEAR_OF_PLANET) t.control.setLength(CLEAR_OF_PLANET * 2 - t.control.length());
          space.cameraOwner = "landing";
          space.astronautHeld = true;
          begin("approach");
          return;
        }
        // Aim the body so the line from the camera through the boots points straight at the moon's center.
        // The moon then sits exactly behind the feet for the whole fall, and just grows.
        const moon = t.moon;
        t.startAstronautRotation.copy(astronaut.quaternion);
        const towardBoots = up.set(0, -CAMERA_ABOVE_FEET, -CAMERA_AHEAD_OF_FEET).normalize().applyQuaternion(astronaut.quaternion);
        const towardMoon = scratch.copy(moon.position).sub(astronaut.position).normalize();
        t.alignedRotation.setFromUnitVectors(towardBoots, towardMoon).multiply(astronaut.quaternion);

        t.landedScale = (moon.radius * LANDED_HEIGHT) / ASTRONAUT_HEIGHT;
        t.startCamera.copy(perspective.position);
        t.startRotation.copy(perspective.quaternion);
        space.cameraOwner = "landing";
        space.astronautHeld = true;
        begin("lookDown");
        return;
      }

      case "lookDown": {
        const k = clamp01(seconds / LOOK_DOWN_SECONDS);
        const e = ease(k);
        astronaut.quaternion.copy(t.startAstronautRotation).slerp(t.alignedRotation, e);
        space.flailAmount = 1 - e;
        astronaut.visible = k > 0.3;
        frameBoots(astronaut, 1);
        perspective.position.copy(t.startCamera).lerp(cameraGoal, e);
        perspective.quaternion.copy(t.startRotation).slerp(rotationGoal, e);
        lens(POV_FOV, POV_NEAR);
        if (space.visor) space.visor.style.opacity = String(1 - clamp01(k * 2));
        if (k >= 1) {
          // measure the boots from the astronaut's center, so they can be placed exactly on the ground
          scratch.copy(feetWorld).sub(astronaut.position);
          t.feetOffset.copy(scratch).applyQuaternion(scratchRotation.copy(astronaut.quaternion).invert());
          t.startPosition.copy(feetWorld);
          t.surfaceNormal.copy(feetWorld).sub(t.moon.position).normalize();
          t.touchdown.copy(t.moon.position).addScaledVector(t.surfaceNormal, t.moon.radius);
          begin("dive");
        }
        return;
      }

      case "dive": {
        const k = clamp01(seconds / DIVE_SECONDS);
        // accelerates hard, then eases off right at the end
        const e = 1 - Math.pow(1 - Math.pow(k, 3.2), DIVE_END_EASE);
        const scale = Math.exp(Math.log(t.landedScale) * e);
        astronaut.scale.setScalar(scale);
        const sole = ASTRONAUT_HEIGHT * t.landedScale * SOLE_BELOW_FOOT_BONE;
        const feetGoal = scratch.copy(t.touchdown).addScaledVector(t.surfaceNormal, sole);
        const feetNow = feetGoal.lerp(t.startPosition, 1 - e);
        astronaut.position
          .copy(feetNow)
          .sub(footA.copy(t.feetOffset).multiplyScalar(scale).applyQuaternion(astronaut.quaternion));
        frameBoots(astronaut, scale);
        perspective.position.copy(cameraGoal);
        perspective.quaternion.copy(rotationGoal);
        lens(POV_FOV + 34 * Math.sin(Math.PI * Math.min(1, k * 1.02)) * k, POV_NEAR * scale);
        if (k >= 1) {
          t.landedCamera.copy(cameraGoal);
          t.landedCameraRotation.copy(rotationGoal);
          events.current.onImpact();
          begin("impact");
        }
        return;
      }

      case "impact": {
        shake(perspective, t.landedCamera, seconds, ASTRONAUT_HEIGHT * t.landedScale);
        if (seconds >= IMPACT_SECONDS) {
          if (space.blackout) space.blackout.style.opacity = "1";
          space.worldHidden = true;
          astronaut.visible = false;
          events.current.onCovered(t.moon.id);
          begin("landed");
        }
        return;
      }

      case "approach": {
        const k = clamp01(seconds / APPROACH_SECONDS);
        const e = ease(k), u = 1 - e;
        perspective.position
          .set(0, 0, 0)
          .addScaledVector(t.startCamera, u * u)
          .addScaledVector(t.control, 2 * u * e)
          .addScaledVector(t.startPosition, e * e);
        shipPosition(space.time, shipAt);
        rotationGoal.setFromRotationMatrix(lookMatrix.lookAt(perspective.position, shipAt, up.set(0, 1, 0)));
        perspective.quaternion.copy(t.startRotation).slerp(rotationGoal, ease(Math.min(1, k / 0.3)));
        lens(POV_FOV, 0.01);
        if (space.blackout) space.blackout.style.opacity = String(clamp01((k - 0.84) / 0.16));
        if (k >= 1) {
          if (space.visor) space.visor.style.opacity = "0";
          space.worldHidden = true;
          standOn(t.moon);
          events.current.onCovered(t.moon.id);
          begin("boarded");
        }
        return;
      }

      case "boarded": {
        const k = clamp01(seconds / BOARDED_FADE_SECONDS);
        if (space.blackout) space.blackout.style.opacity = String(1 - k);
        poseInShip(astronaut, perspective, size.width / size.height);
        lens(BASE_FOV, 0.01);
        if (k >= 1) {
          if (wanted.current) t.phase = "landed";
          else begin("leave");
        }
        return;
      }

      case "landed":
        if (t.moon.ship) {
          poseInShip(astronaut, perspective, size.width / size.height);
          lens(BASE_FOV, 0.01);
        }
        return;

      case "leave": {
        const k = clamp01(seconds / FADE_TO_BLACK_SECONDS);
        if (space.blackout) space.blackout.style.opacity = String(k);
        if (k >= 1) {
          // fully black: swap the page for space. The astronaut is already back up in orbit, floating.
          if (t.moon.ship) standOn(t.moon);
          space.inShip = false;
          events.current.onCovered(null);
          space.worldHidden = false;
          space.astronautHeld = false;
          space.flailAmount = 1;
          astronaut.scale.setScalar(1);
          astronaut.visible = true;
          begin("climb");
        }
        return;
      }

      case "climb": {
        const k = clamp01(seconds / CLIMB_SECONDS);
        const e = ease(k);
        if (space.blackout) space.blackout.style.opacity = String(1 - clamp01(seconds / FADE_FROM_BLACK_SECONDS));
        // distance grows exponentially, so the climb feels steady from the ground all the way up
        const direction = scratch.copy(space.orbitPosition).sub(t.landedCamera);
        const total = direction.length();
        direction.divideScalar(total);
        const startDistance = ASTRONAUT_HEIGHT * t.landedScale;
        const distance = k >= 1 ? total : startDistance * Math.pow(total / startDistance, e);
        perspective.position.copy(t.landedCamera).addScaledVector(direction, distance * Math.min(1, k * 8));
        perspective.quaternion.copy(t.landedCameraRotation).slerp(space.orbitRotation, e);
        const near = POV_NEAR * t.landedScale;
        lens(POV_FOV + (BASE_FOV - POV_FOV) * e, near + (ORBIT_NEAR - near) * e * e);
        if (k >= 1) {
          t.phase = "idle";
          t.moon = null;
          space.snapToOrbit?.();
          space.cameraOwner = "rig";
          perspective.position.copy(space.orbitPosition);
          perspective.quaternion.copy(space.orbitRotation);
          events.current.onBackInOrbit();
        }
        return;
      }
    }
  }, -0.4);

  return null;
}

/** Screen shake: a fast random jolt that decays to nothing. */
function shake(camera: THREE.PerspectiveCamera, rest: THREE.Vector3, seconds: number, size: number) {
  const k = clamp01(1 - seconds / SHAKE_SECONDS);
  const amount = size * SHAKE_STRENGTH * k * k;
  const w = seconds * 58;
  right.set(1, 0, 0).applyQuaternion(camera.quaternion);
  up.set(0, 1, 0).applyQuaternion(camera.quaternion);
  camera.position
    .copy(rest)
    .addScaledVector(right, amount * (Math.sin(w) + 0.6 * Math.sin(w * 1.73 + 1)))
    .addScaledVector(up, amount * (Math.cos(w * 1.31) + 0.6 * Math.sin(w * 2.11)));
}
