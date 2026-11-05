"use client";

import { useEffect, useRef } from "react";
import { space } from "@/lib/space/state";
import styles from "./SpaceExperience.module.css";

/** How open the eye is over time: [seconds, openness]. A crack, a heavy blink, a struggle, then awake. */
const OPENING: [number, number][] = [
  [0, 0],
  [0.5, 0.09],
  [0.85, 0.02],
  [1.4, 0.3],
  [1.8, 0.17],
  [2.6, 1.8],
];

const smooth = (x: number) => x * x * (3 - 2 * x);

function opennessAt(seconds: number) {
  for (let i = 1; i < OPENING.length; i++) {
    const [t0, a] = OPENING[i - 1];
    const [t1, b] = OPENING[i];
    if (seconds <= t1) return a + (b - a) * smooth((seconds - t0) / (t1 - t0));
  }
  return OPENING[OPENING.length - 1][1];
}

/** A black screen with an eye-shaped opening cut out of it. The shape is two curves meeting at pointed corners. */
function eyePath(width: number, height: number, openness: number) {
  const margin = 200;
  const cx = width / 2, cy = height / 2;
  const half = width * (0.34 + 0.75 * openness);
  const lid = height * openness;
  return (
    `M${-margin} ${-margin}H${width + margin}V${height + margin}H${-margin}Z` +
    `M${cx - half} ${cy}Q${cx} ${cy - lid * 1.2} ${cx + half} ${cy}Q${cx} ${cy + lid * 0.8} ${cx - half} ${cy}Z`
  );
}

/** The astronaut coming to: eyes open on the page, and it blurs into focus. */
export function EyeOpening({ onOpen }: { onOpen: () => void }) {
  const eyelids = useRef<SVGPathElement>(null);
  const focus = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (space.blackout) space.blackout.style.opacity = "0";
    const startedAt = performance.now();
    const duration = OPENING[OPENING.length - 1][0];
    let frame = 0;
    const draw = () => {
      const seconds = (performance.now() - startedAt) / 1000;
      const openness = opennessAt(seconds);
      eyelids.current?.setAttribute("d", eyePath(window.innerWidth, window.innerHeight, openness));
      if (focus.current) focus.current.style.backdropFilter = `blur(${Math.max(0, 14 * (1 - seconds / duration))}px)`;
      if (seconds >= duration) onOpen();
      else frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [onOpen]);

  return (
    <div className={styles.eyes} aria-hidden="true">
      <div ref={focus} className={styles.focus} />
      <svg width="100%" height="100%">
        <defs>
          <filter id="eyelid-edge" filterUnits="userSpaceOnUse" x="-300" y="-300" width="6000" height="4000">
            <feGaussianBlur stdDeviation="16" />
          </filter>
        </defs>
        <path ref={eyelids} fill="#000" fillRule="evenodd" filter="url(#eyelid-edge)" />
      </svg>
    </div>
  );
}
