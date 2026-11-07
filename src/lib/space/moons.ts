import * as THREE from "three";
import { VIEW_BACK, VIEW_RIGHT, VIEW_UP } from "./constants";

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
  /** This page is aboard the spaceship, so there's no moon. */
  ship?: boolean;
  /** A page reachable only by its URL, like a prototype: no moon in the sky and no place in the nav. */
  unlisted?: boolean;
};

/** Placed by where they sit in the opening view: x right, y up, z away from the camera. */
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
    position: at(2.85, 1.2, -0.5),
    radius: 0.03,
    tint: "#ffffff",
    world: "sulfur",
    seed: 3.1,
  },
  {
    id: "projects/kargo",
    label: "Kargo Flourishes",
    position: at(3.0, -0.45, 0.5),
    radius: 0.05,
    tint: "#ffffff",
    world: "basalt",
    seed: 7.7,
  },
  {
    id: "projects/storagepug",
    label: "StoragePug (coming soon...)",
    position: at(2.2, -1.5, -0.3),
    radius: 0.02,
    tint: "#ffffff",
    world: "ice",
    seed: 5.2,
  },
  {
    id: "projects/complex",
    label: "Complex",
    position: at(0.9, -1.95, 0.4),
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
    position: at(1.25, 1.65, 0.5),
    radius: 0.018,
    tint: "#ffffff",
    world: "rust",
    seed: 2.3,
  },
  {
    id: "previous-life/video",
    label: "Video",
    position: at(-1.4, 1.95, 0.4),
    radius: 0.022,
    tint: "#ffffff",
    world: "basalt",
    seed: 18.3,
  },
  {
    id: "previous-life/newspaper-editor",
    label: "Newspaper Editor",
    position: at(-3.4, -0.25, 0.2),
    radius: 0.02,
    tint: "#ffffff",
    world: "haze",
    seed: 21.7,
  },
  {
    id: "previous-life/fishmongering",
    label: "Fishmongering",
    position: at(-3.0, -1.1, 0.5),
    radius: 0.028,
    tint: "#ffffff",
    world: "ocean",
    seed: 6.6,
  },
  {
    id: "publications",
    label: "Publications",
    position: at(-1.2, -1.85, -0.2),
    radius: 0.024,
    tint: "#ffffff",
    world: "twoTone",
    seed: 4.8,
  },
  {
    id: "projects/expanding-universe",
    label: "The Expanding Universe",
    position: at(0.1, 2.05, 0.3),
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
    position: at(3.35, 0.45, -0.3),
    radius: 0.022,
    tint: "#ffffff",
    world: "ocean",
    seed: 14.2,
  },
  {
    id: "projects/martian-weather-service",
    label: "Martian Weather Service",
    position: at(3.15, -1.05, 0.3),
    radius: 0.024,
    tint: "#ffffff",
    world: "rust",
    seed: 24.6,
  },
  {
    id: "projects/kaleidoscope-maker",
    label: "Kaleidoscope Maker",
    position: at(-2.1, -2.0, 0.3),
    radius: 0.026,
    tint: "#ffffff",
    world: "sulfur",
    seed: 16.9,
  },
  {
    id: "contact",
    label: "Contact",
    position: at(-2.6, 1.55, 0.2),
    radius: 0.03,
    tint: "#ffffff",
    world: "ice",
    seed: 8.1,
  },
  {
    id: "resume",
    label: "Resume",
    position: at(-3.25, 0.65, -0.2),
    radius: 0.024,
    tint: "#ffd9b8",
    world: "rock",
    seed: 3.7,
  },
];

/** Where each moon sits in the composed opening view. `position` drifts around it; this never moves. */
const HOMES = new Map(MOONS.map((moon) => [moon.id, moon.position.clone()]));

/** Each moon slowly loops around its home spot, far enough to feel alive without breaking up the composition. */
const DRIFT_RADIUS = 0.12;
const DRIFT_PERIOD_MIN = 100;
const DRIFT_PERIOD_MAX = 160;

/** Moves every moon's `position` along its drift, `seconds` into it. Updates in place, so anything holding a moon sees it move. */
export function driftMoons(seconds: number) {
  for (const moon of MOONS) {
    const home = HOMES.get(moon.id);
    if (moon.ship || !home) continue;
    // the seed gives each moon its own speed and starting point
    const period = DRIFT_PERIOD_MIN + ((moon.seed * 7.31) % 1) * (DRIFT_PERIOD_MAX - DRIFT_PERIOD_MIN);
    const angle = (seconds / period) * Math.PI * 2;
    // a loop that starts and ends at home, so a moon is exactly where it was composed at the start of a visit
    const across = Math.sin(angle) * DRIFT_RADIUS;
    const along = (1 - Math.cos(angle)) * DRIFT_RADIUS;
    const heading = moon.seed; // which way round each loop sits
    moon.position
      .copy(home)
      .addScaledVector(VIEW_RIGHT, across * Math.cos(heading) - along * Math.sin(heading))
      .addScaledVector(VIEW_BACK, across * Math.sin(heading) + along * Math.cos(heading))
      .addScaledVector(VIEW_UP, Math.sin(angle * 0.7) * DRIFT_RADIUS * 0.35);
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
    items: ["previous-life/photography", "previous-life/video", "previous-life/newspaper-editor", "previous-life/fishmongering"].map(
      moon,
    ),
  },
  moon("publications"),
  moon("resume"),
  moon("contact"),
];
