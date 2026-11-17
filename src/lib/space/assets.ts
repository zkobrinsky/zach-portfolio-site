import { preload } from "react-dom";

/** The big files the 3D scene loads. */
export const ASSETS = {
  astronaut: "/models/astronaut-parts.glb",
  bust: "/models/zach-bust.glb",
  spaceship: "/models/spaceship.glb",
  moonColor: "/textures/moon-color-4k.jpg",
  moonHeight: "/textures/moon-height-3k.jpg",
} as const;

/**
 * Asks for the scene's files from the page's <head>, so they download alongside the JavaScript. Otherwise
 * nothing asks for them until the canvas code has loaded and rendered, two seconds or so into the visit.
 * The hints have to match how three.js requests each file, or the browser downloads it twice: everything is
 * fetched with fetch(), as an anonymous CORS request.
 */
export function preloadScene({ withHead }: { withHead: boolean }) {
  const files = [
    ASSETS.astronaut,
    ASSETS.spaceship,
    ...(withHead ? [ASSETS.bust] : []),
    ASSETS.moonColor,
    ASSETS.moonHeight,
  ];
  for (const href of files) preload(href, { as: "fetch", crossOrigin: "anonymous", fetchPriority: "high" });
}
