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

/** Easing curves for the flight to the ship. Dev panel only: pick one live to compare. */
export const APPROACH_EASES: Record<string, (x: number) => number> = {
  "in-out cubic": (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  linear: (x) => x,
  "in-out sine": (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  "in-out quint": (x) => (x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2),
  "in-out expo": (x) =>
    x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
  "out cubic": (x) => 1 - Math.pow(1 - x, 3),
  "out quint": (x) => 1 - Math.pow(1 - x, 5),
  "out expo": (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  "in quad, out expo": (x) => (x < 0.3 ? 0.3 * (x / 0.3) ** 2 : 0.3 + 0.7 * (1 - Math.pow(2, (-10 * (x - 0.3)) / 0.7))),
  "out back": (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2),
  "in-out back": (x) => {
    const c = 1.70158 * 1.525;
    return x < 0.5
      ? (Math.pow(2 * x, 2) * ((c + 1) * 2 * x - c)) / 2
      : (Math.pow(2 * x - 2, 2) * ((c + 1) * (x * 2 - 2) + c) + 2) / 2;
  },
  spring: (x) => (x === 1 ? 1 : 1 - Math.exp(-7 * x) * Math.cos(9 * x)),
};

/** The flight to the ship. Everything reads these live, so the dev panel can change them. */
export const shipApproach = {
  ease: "in-out sine",
  seconds: 2.7,
  /** When the white-out starts, as a fraction of the flight. */
  fadeStart: 0.98,
  /** The ramp starts to drop at this fraction of the flight, and is all the way down by the next. */
  hatchOpensAt: 0.71,
  hatchOpenBy: 0.96,
};

/**
 * The belly ramp, in the model's own units (its nose points along -X, up is +Y): hinged at its back edge, the
 * front end swings down like a landing ramp and the light inside spills out. The model has no door, so one is cut
 * out of it: the hull triangles inside this box (up to `depth` above the bottom) become the ramp, and a light
 * sits in the hole behind it.
 */
export const shipHatch = { x: -0.4, y: -1.42, z: 0, length: 2.4, width: 2.15, depth: 0.51, angle: 0.84, glow: 12, beam: 1, light: 0.08, preview: 0 };
/**
 * The flight to the ship has two legs, in the model's units: first out to a point `runIn` ahead of the opening (toward the nose)
 * and `runBelow` under the belly, clear of the hull, then straight in over the lowered ramp to `endBelow` under the opening.
 */
export const shipHatchPath = { runIn: 13, runBelow: 1.6, endBelow: 0.15 };
/** Live: how far open the ramp is (0..1), and where its opening is in world space. Spaceship writes these every frame. */
export const shipHatchState = {
  open: 0,
  center: new THREE.Vector3(),
  /** Straight out of the opening, away from the ship. */
  normal: new THREE.Vector3(0, -1, 0),
  /** Toward the ship's nose. */
  forward: new THREE.Vector3(1, 0, 0),
  /** The flight's last stretch, in world space: where it lines up, where it ends, and the light it looks into. */
  lineUp: new THREE.Vector3(),
  end: new THREE.Vector3(),
  light: new THREE.Vector3(),
};
