import * as THREE from "three";
import { RING_IN, RING_OUT, WORLD_TO_PLANET } from "./constants";
import { SUN_RADIUS, SUN_SCALE } from "./sun";

const fract = (x: number) => x - Math.floor(x);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

function hash(x: number, y: number, z: number) {
  x = fract(x * 0.3183099 + 0.1) * 17;
  y = fract(y * 0.3183099 + 0.1) * 17;
  z = fract(z * 0.3183099 + 0.1) * 17;
  return fract(x * y * z * (x + y + z));
}

function noise(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const h = (a: number, b: number, c: number) => hash(ix + a, iy + b, iz + c);
  return mix(
    mix(mix(h(0, 0, 0), h(1, 0, 0), fx), mix(h(0, 1, 0), h(1, 1, 0), fx), fy),
    mix(mix(h(0, 0, 1), h(1, 0, 1), fx), mix(h(0, 1, 1), h(1, 1, 1), fx), fy),
    fz,
  );
}

function fbm(x: number, y: number, z: number) {
  let a = 0.5, s = 0;
  for (let i = 0; i < 6; i++) {
    s += a * noise(x, y, z);
    x = x * 2.03 + 17.1;
    y = y * 2.03 + 17.1;
    z = z * 2.03 + 17.1;
    a *= 0.5;
  }
  return s;
}

/** Same radial density as ringDensity() in the ring shader. Keep the two in step. */
function ringDensity(r: number) {
  const x = (r - RING_IN) / (RING_OUT - RING_IN);
  if (x < 0 || x > 1) return 0;
  let d = 0.15 + 0.85 * smoothstep(0.25, 0.75, fbm(x * 38, 0.5, 0.5));
  d *= 0.55 + 0.45 * noise(x * 420, 1.5, 0.5);
  d *= 0.18 + 0.82 * smoothstep(0.16, 0.24, x);
  d *= 1 - 0.25 * smoothstep(0.66, 0.72, x);
  d *= 1 - 0.94 * (smoothstep(0.585, 0.6, x) - smoothstep(0.645, 0.66, x));
  d *= 1 - 0.85 * (smoothstep(0.905, 0.91, x) - smoothstep(0.918, 0.923, x));
  d *= smoothstep(0, 0.02, x) * (1 - smoothstep(0.97, 1, x));
  return Math.min(1, Math.max(0, d));
}

const SAMPLES = 48;
const camRight = new THREE.Vector3();
const camUp = new THREE.Vector3();
const point = new THREE.Vector3();
const dir = new THREE.Vector3();
const camLocal = new THREE.Vector3();
const dirLocal = new THREE.Vector3();

/**
 * How much of the sun's disc the camera can see, 0..1. Casts rays to points across the disc and tests
 * each against the planet and the rings. This scales the lens glare, which draws over everything.
 */
export function sunVisibility(camera: THREE.Camera, sunPosition: THREE.Vector3) {
  camera.updateMatrixWorld();
  camRight.setFromMatrixColumn(camera.matrixWorld, 0);
  camUp.setFromMatrixColumn(camera.matrixWorld, 1);
  camLocal.copy(camera.position).applyMatrix4(WORLD_TO_PLANET);
  let sum = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const r = Math.sqrt((i + 0.5) / SAMPLES) * SUN_RADIUS * SUN_SCALE;
    const a = i * 2.39996323;
    point.copy(sunPosition).addScaledVector(camRight, Math.cos(a) * r).addScaledVector(camUp, Math.sin(a) * r);
    dir.copy(point).sub(camera.position);
    const length = dir.length();
    dir.divideScalar(length);

    const b = camera.position.dot(dir);
    const h = b * b - (camera.position.lengthSq() - 1);
    if (h > 0) {
      const hit = -b - Math.sqrt(h);
      if (hit > 0 && hit < length) continue;
    }

    let transmitted = 1;
    dirLocal.copy(dir).transformDirection(WORLD_TO_PLANET);
    if (Math.abs(dirLocal.y) > 1e-6) {
      const t = -camLocal.y / dirLocal.y;
      if (t > 0 && t < length) {
        const radius = Math.hypot(camLocal.x + dirLocal.x * t, camLocal.z + dirLocal.z * t);
        transmitted = Math.exp(-4.5 * ringDensity(radius));
      }
    }
    sum += transmitted;
  }
  return sum / SAMPLES;
}
