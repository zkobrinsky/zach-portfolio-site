import Image from "next/image";
import { pageMetadata } from "@/lib/seo";
import styles from "./page.module.css";

export const metadata = pageMetadata("/projects/storagepug");

export default function StoragepugPage() {
  return (
    <div className={styles.project}>
      <h2>
        <Image className={styles.logo} src="/projects/storagepug-logo.svg" alt="StoragePug" width={193} height={39} unoptimized />
      </h2>
      <p>
        I made a really cool interactive 3D and 2D experience for StoragePug that’s still under NDA. It’s super rad, and
        you’ll just have to wait to see it. Check back next time to see if the NDA’s been lifted...
      </p>
      {/* a blurred still, on purpose: the walkthrough stays off the site until the NDA is lifted */}
      <div className={styles.locked} role="img" aria-label="A locked video, blurred until the NDA is lifted">
        <Image src="/projects/storagepug-locked.jpg" alt="" fill sizes="(max-width: 700px) 100vw, 42rem" />
        <div className={styles.lockedLabel}>
          <span className={styles.lockIcon} aria-hidden>
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="5" y="11" width="14" height="10" rx="1" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </span>
          Walkthrough locked under NDA
        </div>
      </div>
      <h3>What it is</h3>
      <p>
        A 2D map builder that generates a dynamic 3D dashboard. You lay out a map on a two-dimensional canvas, floor by floor,
        and it becomes a live, interactive 3D map driven entirely by real data. I was the tech lead on the map project: I
        architected it and led its development, taking it from initial concept through production-ready release. The
        benchmark was maps of 3,000 elements or more.
      </p>
      <h3>The 2D builder</h3>
      <ul>
        <li>
          Rotation-aware collision detection. Standard bounding boxes fail on rotated shapes, so I implemented the separating
          axis theorem in JavaScript for near pixel-perfect placement at any angle.
        </li>
        <li>
          Everything CSS gives you for free had to be written as math on canvas: snapping, alignment, and text that reflows
          inside rotated shapes by finding the largest unrotated rectangle that fits.
        </li>
        <li>
          Conditional caching re-renders and stores the canvas as an image whenever a zoom or pan ends, instead of
          recalculating everything on every frame.
        </li>
        <li>
          An infinite grid and minimap built from DOM elements layered with the canvas, using a dynamic SVG background to avoid
          browser pixel-rounding artifacts.
        </li>
      </ul>
      <h3>The 3D map</h3>
      <ul>
        <li>
          Built with Three.js and WebGL. Instanced meshes need identical shapes, so I built “material swapping”: thousands of
          different geometries share a handful of materials, each with a static copy and an animating clone.
        </li>
        <li>
          Lighting modeled on the sun. The lights sit absurdly far away, so the direction and quality of the light stay
          consistent on a map of any size.
        </li>
        <li>Trigonometry frames the camera for any layout, since every map is different and built from dynamic data.</li>
        <li>
          DOM elements married to WebGL: a hover popover anchors to an invisible DOM element positioned over the 3D object, so
          two totally different environments feel like one seamless app.
        </li>
      </ul>
    </div>
  );
}
