"use client";

import { type PointerEvent, useEffect, useRef } from "react";
import { space } from "@/lib/space/state";
import styles from "./Joystick.module.css";

/** How far the knob travels from center, in pixels. */
const REACH = 44;
/** A resting thumb shouldn't drift the astronaut. */
const DEAD_ZONE = 0.12;

/** Touch control for flying in POV: the same thrust as W A S D, scaled by how far the knob is pushed. */
export function Joystick() {
  const knob = useRef<HTMLDivElement>(null);

  const moveKnob = (x: number, y: number) => {
    if (knob.current) knob.current.style.transform = `translate(${x}px, ${y}px)`;
  };

  const release = () => {
    space.stick.x = 0;
    space.stick.y = 0;
    moveKnob(0, 0);
  };

  // leaving POV mid-push shouldn't leave the astronaut drifting
  useEffect(
    () => () => {
      space.stick.x = 0;
      space.stick.y = 0;
    },
    [],
  );

  const push = (event: PointerEvent<HTMLDivElement>) => {
    const base = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - (base.left + base.width / 2);
    const y = event.clientY - (base.top + base.height / 2);
    const scale = Math.min(1, REACH / (Math.hypot(x, y) || 1));
    moveKnob(x * scale, y * scale);
    const amount = Math.hypot(x, y) * scale / REACH;
    space.stick.x = amount < DEAD_ZONE ? 0 : (x * scale) / REACH;
    space.stick.y = amount < DEAD_ZONE ? 0 : (y * scale) / REACH;
  };

  return (
    <div
      className={styles.joystick}
      data-joystick
      aria-hidden
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        push(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) push(event);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div ref={knob} className={styles.knob} />
    </div>
  );
}
