import * as THREE from "three";
import { VIEW_BACK, VIEW_RIGHT, VIEW_UP } from "./constants";

export const SUN_RADIUS = 2.4;
const ORBIT_RADIUS = 80;
/** Seconds per lap. */
export const SUN_PERIOD = 720;
const WARP = -0.75;
/** Where the sun starts: already near the planet, so the first eclipse begins about half a minute after load. */
const PHI0 = 0.9;

/**
 * The sun is drawn this far from the camera, along the light direction, and scaled to match,
 * so it sits "at infinity": its position on screen always agrees with the light and shadow angle.
 */
export const SUN_FAR = 6000;
export const SUN_SCALE = SUN_FAR / ORBIT_RADIUS;

export const FIRST_ECLIPSE_AT = ((Math.PI / 2 - PHI0) / (Math.PI * 2)) * SUN_PERIOD;

/**
 * Direction from the planet to the sun at time t. The orbit is time-warped: the sun crawls through
 * the eclipse (25% speed) and hurries while it's behind the opening viewpoint.
 */
export function sunDirection(t: number, out: THREE.Vector3) {
  const phi = PHI0 + (t / SUN_PERIOD) * Math.PI * 2;
  const theta = phi + WARP * Math.sin(phi - Math.PI / 2);
  return out
    .set(0, 0, 0)
    .addScaledVector(VIEW_RIGHT, -Math.cos(theta) * ORBIT_RADIUS)
    .addScaledVector(VIEW_BACK, Math.sin(theta) * ORBIT_RADIUS)
    .addScaledVector(VIEW_UP, 6 * (1 - Math.sin(theta)))
    .normalize();
}
