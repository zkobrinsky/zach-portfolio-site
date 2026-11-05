import { space } from "@/lib/space/state";
import styles from "./SpaceLoader.module.css";

const RAYS = Array.from({ length: 36 }, (_, i) => i * 10);

/** Shown while the 3D scene downloads: a deco sunburst, with a gold ring that fills as it loads. */
export function SpaceLoader({ done }: { done: boolean }) {
  return (
    <div
      ref={(element) => {
        space.loader = element;
      }}
      className={styles.loader}
      data-done={done}
      role="status"
      aria-label="Loading"
    >
      <svg className={styles.emblem} viewBox="-100 -100 200 200" aria-hidden="true">
        {RAYS.map((angle) => (
          <line key={angle} className={styles.ray} x1="0" y1="-62" x2="0" y2={angle % 30 === 0 ? -98 : -84} transform={`rotate(${angle})`} />
        ))}
        <circle className={styles.track} r="54" />
        <circle className={styles.progress} r="54" pathLength="1" transform="rotate(-90)" />
        <g className={styles.orbit}>
          <circle className={styles.moon} cx="54" cy="0" r="3.2" />
        </g>
        {/* the ring is two halves, so the far half can pass behind the planet */}
        <path className={styles.ring} d="M-34 0A34 9 0 0 1 34 0" transform="rotate(-22)" />
        <circle className={styles.planet} r="19" />
        <path className={styles.ring} d="M34 0A34 9 0 0 1 -34 0" transform="rotate(-22)" />
      </svg>
      <p className={styles.label}>
        Preparing for launch <span data-percent>0</span>%
      </p>
    </div>
  );
}
