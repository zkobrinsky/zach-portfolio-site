import * as THREE from "three";

/** Per-frame scene state shared between components. Mutated inside useFrame, never read during render. */
export const space = {
  time: 0,
  sunDirection: new THREE.Vector3(1, 0, 0),
  sunVisible: 1,
  astronaut: null as THREE.Object3D | null,
  head: null as { head: THREE.Object3D; top: THREE.Object3D } | null,
  feet: null as [THREE.Object3D, THREE.Object3D] | null,
  /** True once the helmet is off and Zach's head is on. */
  headOn: false,
  /** True while the view is inside the spaceship. */
  inShip: false,
  /** True while a web page is showing: space is hidden, so so the canvas is see-through over the page. */
  worldHidden: false,
  /** While true, the landing sequence owns the astronaut's position and rotation. */
  astronautHeld: false,
  /** How much of the zero-g float is playing, 0..1. */
  flailAmount: 1,
  /** Who moves the camera: orbit controls and the POV flight, or the landing sequence. */
  cameraOwner: "rig" as "rig" | "landing",
  /** How far the POV flight has got, 0 (orbit) to 1 (in the helmet). */
  flightMix: 0,
  /** Where to return to when leaving POV or a moon. */
  orbitPosition: new THREE.Vector3(),
  orbitRotation: new THREE.Quaternion(),
  /** Ends the POV flight instantly and hands the camera back to orbit controls. */
  snapToOrbit: null as (() => void) | null,
  visor: null as HTMLElement | null,
  /** The loading screen, so progress can update it without re-rendering the page. */
  loader: null as HTMLElement | null,
  /** The black screen after a hard landing. */
  blackout: null as HTMLElement | null,
  hud: null as HTMLElement | null,
  /** The touch joystick in POV. Right and down are positive, each -1 to 1. */
  stick: { x: 0, y: 0 },
};

/** Debug URL params: ?t=<seconds>, ?pov=<0..1>, ?debug, ?impact=<a|b|c>, ?helmet=off */
export function debugParams() {
  const q = new URLSearchParams(window.location.search);
  return {
    timeOffset: parseFloat(q.get("t") ?? "") || 0,
    povMix: parseFloat(q.get("pov") ?? ""),
    hud: q.has("debug"),
    helmetOff: q.get("helmet") === "off",
    impactSound: q.get("impact") ?? "a",
  };
}
