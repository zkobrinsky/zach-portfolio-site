import { useEffect, useRef } from "react";
import { space } from "@/lib/space/state";
import styles from "./SpaceLoader.module.css";

const RAYS = Array.from({ length: 36 }, (_, i) => i * 10);

/** Keyframes per move. The ease is baked into them, so both halves of the ring stay in step. */
const SAMPLES = 32;

/*
  The ring is two arcs, each clipped to one half of the circle and turned into view. Turning them is a transform,
  which the compositor animates even while the main thread is busy mounting the scene, so the fill keeps moving
  through those stalls instead of jumping.
*/
const rightTurn = (p: number) => -135 + 180 * Math.min(p * 2, 1);
const leftTurn = (p: number) => 45 + 180 * Math.max(p * 2 - 1, 0);
/*
  Parked, an arc's ends sit exactly on its half's clip edge, and antialiasing leaks a hairline across at 0° and
  180°. So each arc stays invisible until its half has started to fill.
*/
const rightShown = (p: number) => (p > 0 ? 1 : 0);
const leftShown = (p: number) => (p > 0.5 ? 1 : 0);

function seconds(value: string) {
  const number = parseFloat(value);
  return value.trim().endsWith("ms") ? number / 1000 : number;
}

/** The four numbers of a cubic-bezier() timing function. */
function bezierPoints(value: string) {
  const match = value.match(/cubic-bezier\(([^)]+)\)/);
  if (match) return match[1].split(",").map(Number);
  return value.trim() === "linear" ? [0, 0, 1, 1] : [0.25, 0.1, 0.25, 1];
}

/** A cubic-bezier timing function as a plain function, solved by bisection. */
function cubicBezier([x1, y1, x2, y2]: number[]) {
  const at = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  return (x: number) => {
    let low = 0;
    let high = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2;
      if (at(x1, x2, mid) < x) low = mid;
      else high = mid;
    }
    return at(y1, y2, (low + high) / 2);
  };
}

/** Shown while the 3D scene downloads: a deco sunburst, with a gold ring that fills as it loads. */
export function SpaceLoader({ done }: { done: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);
  const left = useRef<HTMLDivElement>(null);
  const isDone = useRef(done);
  const frame = useRef(0);

  useEffect(() => {
    isDone.current = done;
    const loader = root.current;
    const arcs = [right.current, left.current];
    // runs from the first not-done render until the ring has closed; finishing doesn't stop it, the loop does
    if (done || frame.current || !loader || !arcs[0] || !arcs[1]) return;
    const turns = [rightTurn, leftTurn];
    const shown = [rightShown, leftShown];

    // the move in flight: where it started, where it's going, and its timing (from --step-time and --step-ease)
    let from = 0;
    let to = 0;
    let start = 0;
    let duration = 0;
    let ease = (x: number) => x;
    const shownAt = (now: number) =>
      duration <= 0 || now >= start + duration ? to : from + (to - from) * ease((now - start) / duration);

    /** How fast the ring is moving at `now`, in progress per millisecond. */
    const speedAt = (now: number) => {
      const t = (now - start) / duration;
      if (duration <= 0 || t <= 0 || t >= 1) return 0;
      const dt = 0.001;
      return ((to - from) * (ease(Math.min(t + dt, 1)) - ease(Math.max(t - dt, 0)))) / (2 * dt * duration);
    };

    const moveTo = (target: number, now: number) => {
      const speed = speedAt(now);
      from = shownAt(now);
      to = target;
      start = now;
      const style = getComputedStyle(loader);
      duration = seconds(style.getPropertyValue("--step-time")) * 1000;
      /*
        Each move uses --step-ease, except that it starts at the speed the ring already has, so a new progress
        value carries the motion on instead of stopping it and starting again. The first control point sets the
        starting slope, so it's moved to match.
      */
      const [x1, , x2, y2] = bezierPoints(style.getPropertyValue("--step-ease"));
      const slope = (speed * duration) / (to - from);
      const lead = slope > 0 ? Math.min(x1, 1 / slope) : x1;
      ease = cubicBezier([lead, lead * slope, x2, y2]);
      arcs.forEach((arc, i) => {
        const frames = Array.from({ length: SAMPLES + 1 }, (_, k) => {
          const p = from + (to - from) * ease(k / SAMPLES);
          return { transform: `rotate(${turns[i](p)}deg)`, opacity: shown[i](p) };
        });
        const previous = arc!.getAnimations();
        const animation = arc!.animate(frames, { duration, easing: "linear", fill: "forwards" });
        // pinned to when the move was planned, so a stall before it reaches the compositor can't start it late
        animation.startTime = now;
        previous.forEach((old) => old.cancel());
      });
    };

    frame.current = requestAnimationFrame(function tick() {
      // the timeline's clock, which the animations' start times are measured on
      const now = document.timeline.currentTime as number;
      const target = isDone.current ? 1 : space.loadProgress;
      if (target > to) moveTo(target, now);
      frame.current = isDone.current && now >= start + duration ? 0 : requestAnimationFrame(tick);
    });
  }, [done]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    },
    [],
  );

  return (
    <div
      ref={(element) => {
        root.current = element;
        space.loader = element;
      }}
      className={styles.loader}
      data-done={done}
      role="status"
      aria-label="Loading"
    >
      <div className={styles.emblem}>
        <div className={styles.fill} aria-hidden="true">
          <div className={`${styles.half} ${styles.rightHalf}`}>
            <div ref={right} className={styles.arc} />
          </div>
          <div className={`${styles.half} ${styles.leftHalf}`}>
            <div ref={left} className={styles.arc} />
          </div>
        </div>
        <svg className={styles.art} viewBox="-100 -100 200 200" aria-hidden="true">
          {RAYS.map((angle) => (
            <line
              key={angle}
              className={styles.ray}
              x1="0"
              y1="-62"
              x2="0"
              y2={angle % 30 === 0 ? -98 : -84}
              transform={`rotate(${angle})`}
            />
          ))}
          <circle className={styles.track} r="54" />
          <g className={styles.orbit}>
            <circle className={styles.moon} cx="54" cy="0" r="3.2" />
          </g>
          {/* the ring is two halves, so the far half can pass behind the planet */}
          <path className={styles.ring} d="M-34 0A34 9 0 0 1 34 0" transform="rotate(-22)" />
          <circle className={styles.planet} r="19" />
          <path className={styles.ring} d="M34 0A34 9 0 0 1 -34 0" transform="rotate(-22)" />
        </svg>
      </div>
      <p className={styles.label}>Preparing for launch</p>
    </div>
  );
}
