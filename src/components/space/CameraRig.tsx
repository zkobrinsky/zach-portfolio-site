"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { BASE_FOV, fittedDistance, HOME_CAMERA, ORBIT_NEAR, POV_FOV, POV_NEAR } from "@/lib/space/constants";
import { debugParams, space } from "@/lib/space/state";
import { MOONS } from "@/lib/space/moons";
import { ASTRONAUT_HEIGHT } from "./Astronaut";

const FLY_IN_SECONDS = 1.6;
const FLY_OUT_SECONDS = 4;
const RESET_SECONDS = 1.1;
/** WASD in POV: top speed in scene units per second, and how quickly you drift up to speed. */
const THRUST_SPEED = 0.9;
const THRUST_RESPONSE = 2.5;
/** You can't fly inside the planet. */
const CLOSEST_TO_PLANET = 1.15;
/** Or through a moon: the closest you get to one, in moon radii, leaving room for its mountains. */
const CLOSEST_TO_MOON = 1.25;
const SOLID_MOONS = MOONS.filter((moon) => !moon.ship && !moon.unlisted);
/** How close the camera gets to the head before the astronaut disappears. The helmet is about 0.05 across from its center. */
const HIDE_ASTRONAUT_WITHIN = 0.1;
const MOUSE_SENSITIVITY = 0.0022;
/** A full drag across the screen turns this far, in radians. */
const TOUCH_TURN = 3.2;
/** You can look almost straight up and down, and all the way around. */
const MAX_PITCH = 1.5;
/** How tightly the view tracks your input. Higher is snappier. */
const LOOK_RESPONSE = 30;
/** How fast the Look joystick turns the view at full push, in radians per second. */
const LOOK_STICK_SPEED = 1.8;
/** Panning (right-drag, or two fingers) can move the view's center this far from the planet, past the outer moons. */
const MAX_PAN = 2.5;

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const orbitPosition = space.orbitPosition;
const orbitRotation = space.orbitRotation;
const headPosition = new THREE.Vector3();
const headTop = new THREE.Vector3();
const headUp = new THREE.Vector3();
const headForward = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const eye = new THREE.Vector3();
const shoulder = new THREE.Vector3();
const lookMatrix = new THREE.Matrix4();
const atHelmet = new THREE.Quaternion();
const fromEye = new THREE.Quaternion();
const headTurn = new THREE.Quaternion();
const headEuler = new THREE.Euler(0, 0, 0, "YXZ"); // turn first, then tilt, so the horizon stays level
const ORIGIN = new THREE.Vector3();
const thrust = new THREE.Vector3();
const velocity = new THREE.Vector3();
const travelled = new THREE.Vector3();
const headHome = new THREE.Vector3();
const HOME_DIRECTION = HOME_CAMERA.clone().normalize();
const HOME_ROTATION = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().lookAt(HOME_CAMERA, ORIGIN, new THREE.Vector3(0, 1, 0)),
);
const resetFrom = new THREE.Vector3();
const resetTurn = new THREE.Quaternion();
const resetStep = new THREE.Quaternion();
const resetTarget = new THREE.Vector3();
const target = new THREE.Vector3();
const overshoot = new THREE.Vector3();
const awayFromMoon = new THREE.Vector3();

/** Orbit controls by default. In POV mode this owns the camera and flies it into the astronaut's helmet. */
function lockCursor(canvas: HTMLCanvasElement) {
  if (!window.matchMedia("(pointer: fine)").matches) return;
  Promise.resolve(canvas.requestPointerLock()).catch(() => {});
}

type Props = { pov: boolean; steer: boolean; resetCount: number; startedOnPage: boolean };

export function CameraRig({ pov, steer, resetCount, startedOnPage }: Props) {
  const gl = useThree((state) => state.gl);
  const steerRef = useRef(false);

  const controls = useRef<OrbitControlsImpl>(null);
  const flight = useRef({ mix: 0, from: 0, to: 0, startedAt: -1, inPov: false, forced: NaN });
  const look = useRef(new THREE.Vector2());
  const aim = useRef(new THREE.Vector2());
  const held = useRef(new Set<string>());
  const reset = useRef({ startedAt: -1, distance: HOME_CAMERA.length() });
  const size = useThree((state) => state.size);
  const camera = useThree((state) => state.camera);
  const fitted = fittedDistance(size.width / Math.max(size.height, 1));
  const home = useRef(fitted);
  const fittedWidth = useRef(0);
  const orbitPrepared = useRef(false);

  // Start far enough back to fit the screen. Refit when the width changes (a phone rotating, say),
  // but not when only the height does: mobile browsers change it whenever their address bar slides away.
  // Layout effect, so the first frame already draws from the right distance.
  useLayoutEffect(() => {
    if (size.width === 0 || size.width === fittedWidth.current || space.cameraOwner === "landing" || flight.current.inPov) return;
    fittedWidth.current = size.width;
    home.current = fitted;
    // refit around the planet, and save that as the view to reset to, even if panning had moved the center
    controls.current?.target.set(0, 0, 0);
    camera.position.setLength(fitted);
    controls.current?.update();
    controls.current?.saveState();
    if (startedOnPage && !orbitPrepared.current) {
      // opened straight on a page: act as if we'd already flown in, so going back flies out to this view
      orbitPrepared.current = true;
      orbitPosition.copy(camera.position);
      orbitRotation.copy(HOME_ROTATION);
      Object.assign(flight.current, { inPov: true, mix: 1, to: 1, startedAt: -1 });
      if (controls.current) controls.current.enabled = false;
    }
  }, [size.width, fitted, camera, startedOnPage]);

  useEffect(() => {
    const f = flight.current;
    f.forced = debugParams().povMix;
    if ((pov ? 1 : 0) === f.to) return;
    f.from = f.mix;
    f.to = pov ? 1 : 0;
    f.startedAt = performance.now();
  }, [pov]);

  // Game-style look: the cursor locks to the view, and moving the mouse turns it. A finger drag does the same.
  // Input only counts once the fly-in has completely finished.
  useEffect(() => {
    const canvas = gl.domElement;
    const f = flight.current;
    const ready = () => steerRef.current && f.mix >= 1 && f.to === 1 && f.startedAt < 0;
    const turn = (yaw: number, pitch: number) => {
      if (!ready()) return;
      const a = aim.current;
      a.x += yaw;
      a.y = THREE.MathUtils.clamp(a.y + pitch, -MAX_PITCH, MAX_PITCH);
    };
    const onMouse = (event: MouseEvent) => {
      if (document.pointerLockElement === canvas) turn(-event.movementX * MOUSE_SENSITIVITY, -event.movementY * MOUSE_SENSITIVITY);
    };
    // Esc frees the cursor; clicking the scene takes it back
    const onClick = () => {
      if (steerRef.current && document.pointerLockElement !== canvas) lockCursor(canvas);
    };
    // Looking follows one particular finger, so a thumb on the joystick can fly at the same time.
    let lookFinger: number | null = null;
    let lastX = 0, lastY = 0;
    const onTouchStart = (event: TouchEvent) => {
      if (lookFinger !== null) return;
      const touch = [...event.touches].find((item) => !(item.target as Element).closest?.("[data-joystick]"));
      if (!touch) return;
      lookFinger = touch.identifier;
      lastX = touch.clientX;
      lastY = touch.clientY;
    };
    const onTouchMove = (event: TouchEvent) => {
      const touch = [...event.touches].find((item) => item.identifier === lookFinger);
      if (!touch) return;
      const { clientX, clientY } = touch;
      turn(((lastX - clientX) / window.innerWidth) * TOUCH_TURN, ((lastY - clientY) / window.innerWidth) * TOUCH_TURN);
      lastX = clientX;
      lastY = clientY;
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (![...event.touches].some((item) => item.identifier === lookFinger)) lookFinger = null;
    };
    document.addEventListener("mousemove", onMouse);
    canvas.addEventListener("click", onClick);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("mousemove", onMouse);
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [gl]);

  // the click that enters POV is what lets the browser lock the cursor, so it locks now and takes effect after the flight
  useEffect(() => {
    steerRef.current = steer;
    if (steer) lockCursor(gl.domElement);
    else if (document.pointerLockElement === gl.domElement) document.exitPointerLock();
  }, [steer, gl]);

  // WASD steers the astronaut while in POV
  useEffect(() => {
    const keys = held.current;
    const press = (event: KeyboardEvent) => {
      if ("wasd".includes(event.key.toLowerCase())) keys.add(event.key.toLowerCase());
    };
    const lift = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
    const releaseAll = () => keys.clear();
    window.addEventListener("keydown", press);
    window.addEventListener("keyup", lift);
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("keydown", press);
      window.removeEventListener("keyup", lift);
      window.removeEventListener("blur", releaseAll);
    };
  }, []);

  useEffect(() => {
    // the landing sequence calls this when it's done with the camera
    space.snapToOrbit = () => {
      const f = flight.current;
      f.mix = 0;
      f.to = 0;
      f.startedAt = -1;
    };
    return () => {
      space.snapToOrbit = null;
    };
  }, []);

  useEffect(() => {
    if (resetCount === 0) return;
    if (flight.current.inPov) {
      // already flying out of POV: land on the opening view instead of the saved orbit position
      orbitPosition.copy(HOME_DIRECTION).multiplyScalar(home.current);
      orbitRotation.copy(HOME_ROTATION);
    } else {
      reset.current.startedAt = performance.now();
    }
  }, [resetCount]);

  useFrame(({ camera }, delta) => {
    const f = flight.current;
    const perspective = camera as THREE.PerspectiveCamera;

    const r = reset.current;
    if (r.startedAt >= 0 && !f.inPov) {
      if (controls.current?.enabled) {
        controls.current.enabled = false;
        // measured around wherever panning left the view's center, which glides back to the planet
        resetTarget.copy(controls.current.target);
        resetFrom.copy(perspective.position).sub(resetTarget);
        r.distance = resetFrom.length();
        resetFrom.normalize();
        resetTurn.setFromUnitVectors(resetFrom, HOME_DIRECTION);
      }
      const k = Math.min(1, (performance.now() - r.startedAt) / (RESET_SECONDS * 1000));
      const s = ease(k);
      resetStep.identity().slerp(resetTurn, s);
      target.copy(resetTarget).multiplyScalar(1 - s);
      perspective.position
        .copy(resetFrom)
        .applyQuaternion(resetStep)
        .multiplyScalar(r.distance + (home.current - r.distance) * s)
        .add(target);
      perspective.lookAt(target);
      if (k >= 1) {
        r.startedAt = -1;
        if (controls.current) {
          controls.current.enabled = true;
          controls.current.reset(); // lands exactly on the opening view and clears any leftover momentum
        }
      }
    }

    if (!Number.isNaN(f.forced)) f.mix = f.forced;
    else if (f.startedAt >= 0) {
      const seconds = f.to === 1 ? FLY_IN_SECONDS : FLY_OUT_SECONDS;
      const k = Math.min(1, (performance.now() - f.startedAt) / (seconds * 1000));
      f.mix = f.from + (f.to - f.from) * k;
      if (k >= 1) f.startedAt = -1;
    }

    space.flightMix = f.mix;
    if (space.cameraOwner === "landing") return;

    if (f.mix <= 0 || !space.head) {
      if (f.inPov) {
        f.inPov = false;
        travelled.set(0, 0, 0);
        velocity.set(0, 0, 0);
        perspective.position.copy(orbitPosition);
        perspective.quaternion.copy(orbitRotation);
        perspective.fov = BASE_FOV;
        perspective.near = ORBIT_NEAR;
        perspective.updateProjectionMatrix();
        if (controls.current) controls.current.enabled = true;
        if (space.astronaut) space.astronaut.visible = true;
        if (space.visor) space.visor.style.opacity = "0";
      }
      return;
    }

    if (!f.inPov) {
      f.inPov = true;
      orbitPosition.copy(perspective.position);
      orbitRotation.copy(perspective.quaternion);
      if (controls.current) controls.current.enabled = false;
      look.current.set(0, 0);
      aim.current.set(0, 0);
      r.startedAt = -1;
    }

    const s = ease(f.mix);
    space.head.head.getWorldPosition(headPosition);
    space.head.top.getWorldPosition(headTop);
    headUp.copy(headTop).sub(headPosition).normalize();
    headForward.set(0, 0, 1).transformDirection(space.head.head.matrixWorld);

    // the eye: just in front of the face, looking straight out of the helmet
    eye.copy(headPosition).addScaledVector(headForward, ASTRONAUT_HEIGHT * 0.07);
    lookTarget.copy(eye).add(headForward);
    fromEye.setFromRotationMatrix(lookMatrix.lookAt(eye, lookTarget, headUp));
    // Swiping moves the view by how far you drag; the Look joystick keeps turning for as long as it's held.
    if (f.mix >= 1 && f.to === 1) {
      const turn = LOOK_STICK_SPEED * Math.min(delta, 0.1);
      const a = aim.current;
      a.x -= space.lookStick.x * turn;
      a.y = THREE.MathUtils.clamp(a.y - space.lookStick.y * turn, -MAX_PITCH, MAX_PITCH);
    }
    look.current.lerp(aim.current, 1 - Math.exp(-Math.min(delta, 0.1) * LOOK_RESPONSE));
    fromEye.multiply(headTurn.setFromEuler(headEuler.set(look.current.y, look.current.x, 0)));

    // WASD or the joystick: thrust along the view. It builds and fades gently, like drifting in zero g.
    const keys = held.current;
    thrust.set(
      Number(keys.has("d")) - Number(keys.has("a")) + space.moveStick.x,
      0,
      Number(keys.has("s")) - Number(keys.has("w")) + space.moveStick.y,
    );
    if (f.mix < 1 || f.to !== 1) thrust.set(0, 0, 0);
    thrust.clampLength(0, 1).applyQuaternion(fromEye).multiplyScalar(THRUST_SPEED);
    const step = Math.min(delta, 0.1);
    velocity.lerp(thrust, 1 - Math.exp(-step * THRUST_RESPONSE));
    travelled.addScaledVector(velocity, step);
    headHome.copy(eye);
    eye.addScaledVector(travelled, s);
    if (eye.length() < CLOSEST_TO_PLANET) {
      eye.setLength(CLOSEST_TO_PLANET);
      travelled.copy(eye).sub(headHome);
      velocity.set(0, 0, 0);
    }
    // bump into moons: stop at the surface, but keep any sideways drift so you slide around them
    for (const moon of SOLID_MOONS) {
      const closest = moon.radius * CLOSEST_TO_MOON;
      awayFromMoon.copy(eye).sub(moon.position);
      const distance = awayFromMoon.length();
      if (distance >= closest) continue;
      awayFromMoon.divideScalar(distance || 1);
      eye.copy(moon.position).addScaledVector(awayFromMoon, closest);
      travelled.copy(eye).sub(headHome);
      const inward = velocity.dot(awayFromMoon);
      if (inward < 0) velocity.addScaledVector(awayFromMoon, -inward);
    }

    // the path: orbit position, over the shoulder along the line of sight, into the helmet
    shoulder
      .copy(headPosition)
      .addScaledVector(headForward, -ASTRONAUT_HEIGHT * 1.6)
      .addScaledVector(headUp, ASTRONAUT_HEIGHT * 0.45);
    const u = 1 - s;
    perspective.position
      .set(0, 0, 0)
      .addScaledVector(orbitPosition, u * u)
      .addScaledVector(shoulder, 2 * u * s)
      .addScaledVector(eye, s * s);

    // the view: orbit view, the back of the helmet, the astronaut's view
    atHelmet.setFromRotationMatrix(lookMatrix.lookAt(perspective.position, headPosition, headUp));
    if (s < 0.75) perspective.quaternion.copy(orbitRotation).slerp(atHelmet, ease(s / 0.75));
    else perspective.quaternion.copy(atHelmet).slerp(fromEye, ease((s - 0.75) / 0.25));

    perspective.fov = BASE_FOV + (POV_FOV - BASE_FOV) * s;
    perspective.near = ORBIT_NEAR + (POV_NEAR - ORBIT_NEAR) * s;
    perspective.updateProjectionMatrix();

    // You don't see your own head. The model vanishes just before the camera would touch the helmet, so
    // you never pass through it, and the visor darkens on the way in to cover the cut.
    const helmetGap = lookTarget.copy(perspective.position).addScaledVector(travelled, -s).distanceTo(headPosition);
    if (space.astronaut) space.astronaut.visible = s < 0.5 || helmetGap > HIDE_ASTRONAUT_WITHIN;
    if (space.visor) {
      const visor = 1 - THREE.MathUtils.smoothstep(helmetGap, HIDE_ASTRONAUT_WITHIN, HIDE_ASTRONAUT_WITHIN * 1.8);
      space.visor.style.opacity = String(s < 0.5 ? 0 : visor);
    }
  }, -0.5);

  // panning moves the camera and its center together, so pull both back when the center strays too far
  const keepPanNearby = () => {
    const c = controls.current;
    if (!c || c.target.length() <= MAX_PAN) return;
    overshoot.copy(c.target).sub(target.copy(c.target).setLength(MAX_PAN));
    c.target.sub(overshoot);
    c.object.position.sub(overshoot);
  };

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={[0, 0, 0]}
      onChange={keepPanNearby}
      enableDamping
      dampingFactor={0.06}
      rotateSpeed={0.5}
      zoomSpeed={0.6}
      minDistance={3}
      maxDistance={fitted * 2}
    />
  );
}
