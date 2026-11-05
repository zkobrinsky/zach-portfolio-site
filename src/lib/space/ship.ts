import * as THREE from "three";
import { PLANET_TILT } from "./constants";

/** Just outside the rings, which end at 2.27. */
export const SHIP_ORBIT_RADIUS = 2.65;
/** Seconds per lap: slow enough that you can't see it moving. */
const SHIP_ORBIT_SECONDS = 3600;
const SHIP_ORBIT_START = 1.2;
/** How far the orbit leans away from the rings, so it passes over them. */
export const SHIP_ORBIT_LEAN = 0.1;

export const shipOrbitAngle = (t: number) => SHIP_ORBIT_START + (t / SHIP_ORBIT_SECONDS) * Math.PI * 2;

const lean = new THREE.Euler(SHIP_ORBIT_LEAN, 0, 0);

/** Where the ship is at time t, in world space. */
export function shipPosition(t: number, out: THREE.Vector3) {
  const angle = shipOrbitAngle(t);
  return out
    .set(Math.cos(angle), 0, Math.sin(angle))
    .multiplyScalar(SHIP_ORBIT_RADIUS)
    .applyEuler(lean)
    .applyEuler(PLANET_TILT);
}
