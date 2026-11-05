import * as THREE from "three";

export const RING_IN = 1.24;
export const RING_OUT = 2.27;
export const PLANET_TILT = new THREE.Euler(0.12, 0, 0.42);

export const BASE_FOV = 32;
export const POV_FOV = 58;
export const POV_NEAR = 0.004;
export const ORBIT_NEAR = 0.1;
export const HOME_DISTANCE = 8.2;
const HOME_YAW = -0.35;
const HOME_PITCH = 0.16;

/** The opening viewpoint. The planet sits at the world origin. */
export const HOME_CAMERA = new THREE.Vector3(
  Math.sin(HOME_YAW) * Math.cos(HOME_PITCH),
  Math.sin(HOME_PITCH),
  Math.cos(HOME_YAW) * Math.cos(HOME_PITCH),
).multiplyScalar(HOME_DISTANCE);

/** Half the rings' width, plus a margin. */
const PLANET_HALF_WIDTH = RING_OUT + 0.28;
/** How far the astronaut's outer hand reaches left of center, plus a margin. */
const ASTRONAUT_REACH = 1.5;
/** The astronaut floats this far in front of the planet, so it's closer to the camera and looks wider. */
const ASTRONAUT_DEPTH = HOME_DISTANCE - 4;

/**
 * How far back the camera starts so the planet and astronaut both fit the screen's width.
 * Narrow screens need more distance; wide ones stay at the standard distance.
 */
export function fittedDistance(aspect: number) {
  const halfWidth = Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2)) * aspect;
  return Math.max(HOME_DISTANCE, PLANET_HALF_WIDTH / halfWidth, ASTRONAUT_DEPTH + ASTRONAUT_REACH / halfWidth);
}

/** World-space axes as seen from the opening viewpoint. */
export const VIEW_BACK = HOME_CAMERA.clone().negate().normalize();
export const VIEW_RIGHT = new THREE.Vector3().crossVectors(VIEW_BACK, new THREE.Vector3(0, 1, 0)).normalize();
export const VIEW_UP = new THREE.Vector3().crossVectors(VIEW_RIGHT, VIEW_BACK).normalize();

/** Planet-local <- world. The planet only ever has this fixed tilt. */
export const WORLD_TO_PLANET = new THREE.Matrix4().makeRotationFromEuler(PLANET_TILT).invert();
