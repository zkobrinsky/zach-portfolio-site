"use client";

import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { HOME_CAMERA, VIEW_BACK, VIEW_RIGHT, VIEW_UP } from "@/lib/space/constants";
import { debugParams, space } from "@/lib/space/state";

const MODEL_URL = "/models/astronaut-parts.glb";
/** The model comes in parts. Hiding this one takes the helmet off, leaving a closed body with a smooth neck opening. */
const HELMET_PART = "helmet";
export const ASTRONAUT_HEIGHT = 0.45;

/** Overall calmness of the float. Lower is gentler and slower. */
const FLAIL_AMOUNT = 0.22;
const FLAIL_SPEED = 0.28;

/** Bone: [x, y, z] range in radians, then cycles per second. */
const FLAIL: Record<string, [number, number, number, number]> = {
  LeftArm: [0.35, 0.2, 0.45, 0.31],
  RightArm: [0.35, 0.2, 0.45, 0.27],
  LeftForeArm: [0.25, 0.15, 0.35, 0.43],
  RightForeArm: [0.25, 0.15, 0.35, 0.39],
  LeftHand: [0.25, 0.2, 0.25, 0.55],
  RightHand: [0.25, 0.2, 0.25, 0.51],
  LeftUpLeg: [0.25, 0.08, 0.12, 0.21],
  RightUpLeg: [0.25, 0.08, 0.12, 0.24],
  LeftLeg: [0.3, 0, 0, 0.29],
  RightLeg: [0.3, 0, 0, 0.26],
  Spine: [0.06, 0.05, 0.05, 0.17],
  Spine01: [0.06, 0.05, 0.05, 0.19],
  neck: [0.08, 0.1, 0.05, 0.23],
  Head: [0.1, 0.12, 0.06, 0.2],
};

type FlailBone = {
  bone: THREE.Object3D;
  rest: THREE.Quaternion;
  range: [number, number, number];
  frequency: number;
  phase: number;
};

function pixels(image: CanvasImageSource, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(image, 0, 0, width, height);
  return { canvas, context, data: context.getImageData(0, 0, width, height) };
}

/**
 * Recolors the suit's orange pads and the tan under the helmet to white. Keeps each pixel's brightest channel so the quilting survives,
 * and skips metallic pixels (glTF metalness is the blue channel) so the gold visor stays gold.
 */
function whitenPads(texture: THREE.Texture, metalness: THREE.Texture | null, maxAnisotropy: number) {
  const image = texture.image as ImageBitmap;
  const { canvas, context, data } = pixels(image, image.width, image.height);
  const metal = metalness ? pixels(metalness.image as ImageBitmap, image.width, image.height).data.data : null;
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const max = Math.max(r, g, b);
    const saturation = max ? (max - Math.min(r, g, b)) / max : 0;
    if (r < g || g < b || saturation <= 0.1 || (metal && metal[i + 2] > 110)) continue;
    const hue = (g - b) / Math.max(1, r - b);
    const amount = Math.min(1, (saturation - 0.1) / 0.1) * (hue > 0.05 && hue < 0.85 ? 1 : 0);
    const v = Math.min(255, max * 0.97 + 6);
    d[i] = r + (v - r) * amount;
    d[i + 1] = g + (v * 0.985 - g) * amount;
    d[i + 2] = b + (v * 0.96 - b) * amount;
  }
  context.putImageData(data, 0, 0);
  const result = new THREE.CanvasTexture(canvas);
  result.flipY = texture.flipY;
  result.colorSpace = texture.colorSpace;
  result.wrapS = texture.wrapS;
  result.wrapT = texture.wrapT;
  result.anisotropy = maxAnisotropy;
  return result;
}

/** One-time setup on the loaded model. Cached on the scene, since effects can run twice in development. */
function prepare(model: THREE.Object3D, maxAnisotropy: number): FlailBone[] {
  if (model.userData.flail) return model.userData.flail;

  const box = new THREE.Box3().setFromObject(model);
  const scale = ASTRONAUT_HEIGHT / box.getSize(new THREE.Vector3()).y;
  model.scale.setScalar(scale);
  model.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-scale);

  const bones: FlailBone[] = [];
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.frustumCulled = false;
      object.receiveShadow = true;
      const material = object.material as THREE.MeshStandardMaterial;
      // the parts share one material, so this only needs doing once
      if (material.map && !material.userData.whitened) {
        material.userData.whitened = true;
        material.map = whitenPads(material.map, material.metalnessMap, maxAnisotropy);
      }
    }
    const spec = object instanceof THREE.Bone ? FLAIL[object.name] : undefined;
    if (spec) {
      bones.push({
        bone: object,
        rest: object.quaternion.clone(),
        range: [spec[0] * FLAIL_AMOUNT, spec[1] * FLAIL_AMOUNT, spec[2] * FLAIL_AMOUNT],
        frequency: spec[3] * FLAIL_SPEED,
        phase: bones.length * 2.39996,
      });
    }
  });
  model.userData.flail = bones;
  return bones;
}

const BUST_URL = "/models/zach-bust.glb";
/** Where the bust goes, in the astronaut model's own units (it's 1.9 tall, facing +Z). */
const BUST_SCALE = 0.285;
const BUST_POSITION = new THREE.Vector3(0, 1.648, -0.05);
/**
 * The suit's neck ring, for when the helmet is off. The model's real ring belongs to its helmet part, so this is
 * a separate finished part built to the same measurements: 0.15 radius, climbing 22 degrees from chest to neck.
 */
const NECK_RING_CENTER = new THREE.Vector3(0, 1.608, -0.045);
/** Slimmer than the helmet's ring, since no helmet has to fit on it. */
const NECK_RING_SCALE = 0.9;
/** How tall it stands, as a share of its full height. */
const NECK_RING_HEIGHT = 0.67;
const NECK_RING_TILT = Math.atan(0.41);

function neckRing() {
  const lathe = (points: number[][], color: string, roughness: number, metalness: number) =>
    new THREE.Mesh(
      new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), 96),
      new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.DoubleSide }),
    );
  const ring = new THREE.Group();
  ring.add(
    // the silver lip, rounded over at the top
    lathe([[0.128, 0.004], [0.131, 0.016], [0.14, 0.021], [0.15, 0.018], [0.154, 0.006], [0.154, -0.012]], "#c9c6bf", 0.45, 0.35),
    // the dark band beneath it
    lathe([[0.154, -0.012], [0.158, -0.018], [0.158, -0.036], [0.15, -0.046]], "#2b2a29", 0.7, 0.2),
    // dark fabric, funneling down from the lip to the neck
    lathe([[0.128, 0.004], [0.112, -0.006], [0.09, -0.03], [0.06, -0.075]], "#1a1918", 1, 0),
  );
  ring.position.copy(NECK_RING_CENTER);
  ring.rotation.x = NECK_RING_TILT;
  ring.scale.set(NECK_RING_SCALE, NECK_RING_SCALE * NECK_RING_HEIGHT, NECK_RING_SCALE);
  return ring;
}

/** Swaps the helmet for Zach's head. The bust rides on the head bone, so it moves with the body. */
function Bust({ model, bones }: { model: THREE.Object3D; bones: FlailBone[] }) {
  const { scene: bust } = useGLTF(BUST_URL);
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());

  useLayoutEffect(() => {
    const head = model.getObjectByName("Head");
    const helmet = model.getObjectByName(HELMET_PART);
    if (!head || !helmet) return;
    helmet.visible = false;

    bust.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const skin = object.material as THREE.MeshStandardMaterial;
      skin.side = THREE.DoubleSide;
      // match the suit's soft, matte finish: the generated maps make hair and skin look gritty and sparkly
      skin.metalness = 0;
      skin.metalnessMap = null;
      skin.roughness = 0.8;
      skin.roughnessMap = null;
      skin.normalScale.setScalar(0.3);
      skin.needsUpdate = true;
      for (const map of [skin.map, skin.normalMap]) if (map) map.anisotropy = maxAnisotropy;
    });

    // place it against the suit at rest, then hand it to the head bone without moving it
    for (const { bone, rest } of bones) bone.quaternion.copy(rest);
    bust.scale.setScalar(BUST_SCALE);
    bust.position.copy(BUST_POSITION);
    bust.rotation.set(0, 0, 0);
    const ring = neckRing();
    model.add(bust, ring);
    model.updateMatrixWorld(true);
    head.attach(bust);
    // the ring belongs to the suit, so it moves with the chest, not the head
    (model.getObjectByName("Spine") ?? head).attach(ring);
    space.headOn = true;

    return () => {
      space.headOn = false;
      head.remove(bust);
      ring.removeFromParent();
      helmet.visible = true;
    };
  }, [bust, model, bones, maxAnisotropy]);

  return null;
}

const HOME_POSITION = HOME_CAMERA.clone()
  .addScaledVector(VIEW_BACK, 4)
  .addScaledVector(VIEW_RIGHT, -1.05)
  .addScaledVector(VIEW_UP, 0.32);

/** Turns the astronaut toward the opening view, looking slightly past the planet. */
const FACING_VIEWER = Math.atan2(HOME_CAMERA.x - HOME_POSITION.x, HOME_CAMERA.z - HOME_POSITION.z);

/** Enough of a turn that the fly-in passes beside the head, not through the face. */
const TURNED_TOWARD_PLANET = 0.9;

const turn = new THREE.Quaternion();
const euler = new THREE.Euler();

export function Astronaut({ helmetOff, preloadHead }: { helmetOff: boolean; preloadHead: boolean }) {
  const { scene: model } = useGLTF(MODEL_URL);
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const group = useRef<THREE.Group>(null);
  const bones = useRef<FlailBone[]>([]);
  const [wornBones, setWornBones] = useState<FlailBone[] | null>(null);

  // start downloading the head as soon as a trip to the ship begins
  useEffect(() => {
    if (preloadHead) useGLTF.preload(BUST_URL);
  }, [preloadHead]);

  // Layout effect, so it runs before any frame can draw: the raw model is over four times too big.
  useLayoutEffect(() => {
    bones.current = prepare(model, maxAnisotropy);
    const head = model.getObjectByName("Head");
    const top = model.getObjectByName("head_end");
    if (head && top) space.head = { head, top };
    const leftFoot = model.getObjectByName("LeftFoot");
    const rightFoot = model.getObjectByName("RightFoot");
    if (leftFoot && rightFoot) space.feet = [leftFoot, rightFoot];
    space.astronaut = group.current;
    if (group.current) group.current.visible = true;
    setWornBones(bones.current);

    return () => {
      space.head = null;
      space.feet = null;
      space.astronaut = null;
    };
  }, [model, maxAnisotropy]);

  useFrame(() => {
    if (!group.current) return;
    const t = space.time;
    if (!space.astronautHeld) {
      // floats in front of the planet, a little left of center, barely drifting
      group.current.position
        .copy(HOME_POSITION)
        .addScaledVector(VIEW_RIGHT, Math.sin(t * 0.045) * 0.035)
        .addScaledVector(VIEW_UP, Math.sin(t * 0.063) * 0.02);
      // sways a little, but always faces the viewer
      group.current.rotation.set(0.2 + 0.08 * Math.sin(t * 0.04), FACING_VIEWER + TURNED_TOWARD_PLANET + 0.14 * Math.sin(t * 0.05), 0.1 * Math.sin(t * 0.03));
    }

    const amount = space.flailAmount;
    for (const { bone, rest, range, frequency, phase } of bones.current) {
      const w = t * frequency * Math.PI * 2;
      euler.set(
        amount * range[0] * Math.sin(w + phase),
        amount * range[1] * Math.sin(w * 0.73 + phase * 1.7),
        amount * range[2] * Math.sin(w * 1.21 + phase * 0.6),
      );
      bone.quaternion.copy(rest).multiply(turn.setFromEuler(euler));
    }
    group.current.updateMatrixWorld(true);
  }, -2);

  return (
    <group ref={group} visible={false}>
      <primitive object={model} />
      {wornBones && (helmetOff || debugParams().helmetOff) && (
        <Suspense fallback={null}>
          <Bust model={model} bones={wornBones} />
        </Suspense>
      )}
    </group>
  );
}

useGLTF.preload(MODEL_URL);
