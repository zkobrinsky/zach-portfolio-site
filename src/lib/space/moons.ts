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
    label: "Kargo",
    position: at(3.0, -0.45, 0.5),
    radius: 0.05,
    tint: "#ffffff",
    world: "basalt",
    seed: 7.7,
  },
  {
    id: "projects/storagepug",
    label: "StoragePug",
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
    id: "previous-life/fish-mongering",
    label: "Fish Mongering",
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
      "projects/storagepug",
      "projects/complex",
    ].map(moon),
  },
  {
    label: "Previous Life",
    items: ["previous-life/photography", "previous-life/fish-mongering"].map(
      moon,
    ),
  },
  moon("publications"),
  moon("resume"),
  moon("contact"),
];
