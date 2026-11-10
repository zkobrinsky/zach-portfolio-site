import * as THREE from "three";
import { orbitSeconds, PLANET_TILT, VIEW_BACK, VIEW_RIGHT, VIEW_UP } from "./constants";

export const MOON_WORLDS = [
  "rock",
  "ice",
  "sulfur",
  "rust",
  "twoTone",
  "basalt",
  "haze",
  "ocean",
] as const;
export type MoonWorld = (typeof MOON_WORLDS)[number];

export type MoonSpec = {
  /** The page's URL, without the leading slash. */
  id: string;
  label: string;
  position: THREE.Vector3;
  radius: number;
  /** Multiplies the surface color. */
  tint: string;
  /** What kind of world it is. */
  world: MoonWorld;
  /** Shifts the terrain and patterns, so no two moons share features. */
  seed: number;
  /** Orbits the opposite way round from the ship and the other moons. */
  retrograde?: boolean;
  /** This page is aboard the spaceship, so there's no moon. */
  ship?: boolean;
  /** A page reachable only by its URL, like a prototype: no moon in the sky and no place in the nav. */
  unlisted?: boolean;
};

/** Placed by where they start in the opening view: x right, y up, z away from the camera. Their distance from the planet (0, 0, 0) sets their orbit. */
const at = (x: number, y: number, z: number) =>
  new THREE.Vector3()
    .addScaledVector(VIEW_RIGHT, x)
    .addScaledVector(VIEW_UP, y)
    .addScaledVector(VIEW_BACK, z);

/** One moon per page. Nav items that only open a dropdown don't get one. */
export const MOONS: MoonSpec[] = [
  {
    id: "projects/cards-with-friends",
    label: "Cards with Friends",
    position: at(3.12, 1.31, 0.22),
    radius: 0.03,
    tint: "#ffffff",
    world: "sulfur",
    seed: 3.1,
    retrograde: true,
  },
  {
    id: "projects/kargo",
    label: "Kargo Flourishes",
    position: at(3.14, -0.47, 0.9),
    radius: 0.05,
    tint: "#ffffff",
    world: "basalt",
    seed: 7.7,
  },
  {
    id: "projects/storagepug",
    label: "StoragePug (coming soon...)",
    position: at(2.37, -1.61, 0.3),
    radius: 0.02,
    tint: "#ffffff",
    world: "ice",
    seed: 5.2,
    retrograde: true,
  },
  {
    id: "projects/complex",
    label: "Complex",
    position: at(1.04, -2.24, 1.7),
    radius: 0.035,
    tint: "#ffffff",
    world: "haze",
    seed: 9.4,
  },
  {
    id: "about",
    label: "About",
    position: at(0, 0, 0),
    radius: 0,
    tint: "#ffffff",
    world: "rock",
    seed: 0,
    ship: true,
  },
  {
    id: "previous-life/photography",
    label: "Photography",
    position: at(1.43, 1.89, 1.73),
    radius: 0.018,
    tint: "#ffffff",
    world: "rust",
    seed: 2.3,
  },
  {
    id: "previous-life/video",
    label: "Video",
    position: at(-1.57, 2.19, 1.47),
    radius: 0.022,
    tint: "#ffffff",
    world: "basalt",
    seed: 18.3,
    retrograde: true,
  },
  {
    id: "previous-life/newspaper-editor",
    label: "Newspaper Editor",
    position: at(-3.63, -0.27, 0.77),
    radius: 0.02,
    tint: "#ffffff",
    world: "haze",
    seed: 21.7,
  },
  {
    id: "previous-life/fishmongering",
    label: "Fishmongering",
    position: at(-3.14, -1.15, 0.91),
    radius: 0.028,
    tint: "#ffffff",
    world: "ocean",
    seed: 6.6,
    retrograde: true,
  },
  {
    id: "previous-life/science",
    label: "Science",
    position: at(-0.4, -2.6, 2.75),
    radius: 0.022,
    tint: "#ffffff",
    world: "ocean",
    seed: 27.3,
  },
  {
    id: "publications",
    label: "Publications",
    position: at(-0.99, -1.53, -1.59),
    radius: 0.024,
    tint: "#ffffff",
    world: "twoTone",
    seed: 4.8,
  },
  {
    id: "projects/expanding-universe",
    label: "The Expanding Universe",
    position: at(0.11, 2.18, 0.82),
    radius: 0.028,
    tint: "#ffffff",
    world: "haze",
    seed: 12.4,
  },
  {
    id: "projects/improv-buddy",
    label: "Improv Buddy",
    // never drawn; this is just where the camera pretends it landed, for the trip back to orbit
    position: at(0.6, 2.2, 0.5),
    radius: 0.03,
    tint: "#ffffff",
    world: "ocean",
    seed: 14.2,
    unlisted: true,
  },
  {
    id: "projects/baby-kick-sensor",
    label: "Baby Kick Sensor",
    position: at(3.61, 0.49, 0.32),
    radius: 0.022,
    tint: "#ffffff",
    world: "ocean",
    seed: 14.2,
  },
  {
    id: "projects/martian-weather-service",
    label: "Martian Weather Service",
    position: at(3.33, -1.11, 0.79),
    radius: 0.024,
    tint: "#ffffff",
    world: "rust",
    seed: 24.6,
  },
  {
    id: "projects/kaleidoscope-maker",
    label: "Kaleidoscope Maker",
    position: at(-2.21, -2.1, 0.74),
    radius: 0.026,
    tint: "#ffffff",
    world: "sulfur",
    seed: 16.9,
    retrograde: true,
  },
  {
    id: "contact",
    label: "Contact",
    position: at(-2.71, 1.62, 0.57),
    radius: 0.03,
    tint: "#ffffff",
    world: "ice",
    seed: 8.1,
  },
  {
    id: "resume",
    label: "Resume",
    position: at(-3.46, 0.69, 0.31),
    radius: 0.024,
    tint: "#ffd9b8",
    world: "rock",
    seed: 3.7,
  },
];

/** The axis the rings and the ship turn around, right-handed. A moon's orbit leans as little from this as its starting spot allows. */
const PROGRADE_POLE = new THREE.Vector3(0, -1, 0).applyEuler(PLANET_TILT);

/**
 * Every moon circles the planet at its own distance, on a plane through its spot in the opening view. No two
 * distances are close enough for moons to touch, and all of them clear the rings and the ship, whichever way they go.
 */
const ORBITS = MOONS.filter((moon) => !moon.ship).map((moon) => {
  const start = moon.position.clone();
  const direction = start.clone().normalize();
  const pole = PROGRADE_POLE.clone().addScaledVector(direction, -PROGRADE_POLE.dot(direction)).normalize();
  return {
    moon,
    start,
    /** A quarter of a lap on from `start`. */
    ahead: new THREE.Vector3().crossVectors(pole, start),
    radiansPerSecond: ((moon.retrograde ? -1 : 1) * Math.PI * 2) / orbitSeconds(start.length()),
  };
});

/** Moves every moon along its orbit, `seconds` into it. Updates in place, so anything holding a moon sees it move. */
export function orbitMoons(seconds: number) {
  for (const { moon, start, ahead, radiansPerSecond } of ORBITS) {
    const angle = seconds * radiansPerSecond;
    moon.position.copy(start).multiplyScalar(Math.cos(angle)).addScaledVector(ahead, Math.sin(angle));
  }
}

export type NavItem = { label: string; items: MoonSpec[] } | MoonSpec;

const moon = (id: string) => MOONS.find((spec) => spec.id === id)!;

/** The main nav, in order. An entry with `items` is a dropdown. */
export const NAV: NavItem[] = [
  moon("about"),
  {
    label: "Projects",
    items: [
      "projects/cards-with-friends",
      "projects/kargo",
      "projects/complex",
      "projects/expanding-universe",
      "projects/baby-kick-sensor",
      "projects/kaleidoscope-maker",
      "projects/martian-weather-service",
      "projects/storagepug",
    ].map(moon),
  },
  {
    label: "Previous Life",
    items: ["previous-life/science", "previous-life/photography", "previous-life/video", "previous-life/newspaper-editor", "previous-life/fishmongering"].map(
      moon,
    ),
  },
  moon("publications"),
  moon("resume"),
  moon("contact"),
];
