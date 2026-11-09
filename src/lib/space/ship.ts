import * as THREE from "three";
import { orbitSeconds, PLANET_TILT } from "./constants";

/** Just outside the rings, which end at 2.27. */
export const SHIP_ORBIT_RADIUS = 2.65;
const SHIP_ORBIT_START = 1.2;
/** How far the orbit leans away from the rings, so it passes over them. */
export const SHIP_ORBIT_LEAN = 0.1;

/** Where the ship sits. Everything reads these live, so the dev panel can change them. */
export const shipPlacement = {
  start: SHIP_ORBIT_START,
  radius: SHIP_ORBIT_RADIUS,
  lean: SHIP_ORBIT_LEAN,
  pitch: 0,
  yaw: 0,
  roll: 0,
  scale: 1,
};

/**
 * The sun is behind the ship for most of the lap, which leaves it a silhouette. `side` is a hard light that stands in
 * for the sun, from the sun's side of the screen but never behind the ship. `front` is how far it leans toward the viewer:
 * lower skims across the hull for more drama. `fill` barely lifts the shadows.
 */
export const shipLight = { fill: 0.04, side: 1.1, front: -0.15 };

export const shipOrbitAngle = (t: number) => shipPlacement.start + (t / orbitSeconds(shipPlacement.radius)) * Math.PI * 2;

const lean = new THREE.Euler();

/** Where the ship is at time t, in world space. */
export function shipPosition(t: number, out: THREE.Vector3) {
  const angle = shipOrbitAngle(t);
  return out
    .set(Math.cos(angle), 0, Math.sin(angle))
    .multiplyScalar(shipPlacement.radius)
    .applyEuler(lean.set(shipPlacement.lean, 0, 0))
    .applyEuler(PLANET_TILT);
}
