"use client";

import { type PointerEvent, useEffect, useRef } from "react";
import { space } from "@/lib/space/state";
import styles from "./Joystick.module.css";

/** How far the knob travels from center, in pixels. */
const REACH = 44;
/** A resting thumb shouldn't drift the view. */
const DEAD_ZONE = 0.12;

type Props = { label: "Move" | "Look"; side: "left" | "right" };

/** Touch control in POV. Move is the same thrust as W A S D; Look turns the view. Both scale with how far they're pushed. */
export function Joystick({ label, side }: Props) {
  const knob = useRef<HTMLDivElement>(null);
  const stick = () => (label === "Move" ? space.moveStick : space.lookStick);
  const setStick = (x: number, y: number) => Object.assign(stick(), { x, y });

  const moveKnob = (x: number, y: number) => {
    if (knob.current) knob.current.style.transform = `translate(${x}px, ${y}px)`;
  };

  const release = () => {
    setStick(0, 0);
    moveKnob(0, 0);
  };

  // leaving POV mid-push shouldn't leave the view drifting
  useEffect(
    () => () => {
      Object.assign(label === "Move" ? space.moveStick : space.lookStick, { x: 0, y: 0 });
    },
    [label],
  );

  const push = (event: PointerEvent<HTMLDivElement>) => {
    const base = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - (base.left + base.width / 2);
    const y = event.clientY - (base.top + base.height / 2);
    const scale = Math.min(1, REACH / (Math.hypot(x, y) || 1));
    moveKnob(x * scale, y * scale);
    const amount = (Math.hypot(x, y) * scale) / REACH;
    if (amount < DEAD_ZONE) setStick(0, 0);
    else setStick((x * scale) / REACH, (y * scale) / REACH);
  };

  return (
    <div
      className={styles.joystick}
      data-joystick
      data-side={side}
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
      <span className={styles.label}>{label}</span>
      <div ref={knob} className={styles.knob} />
    </div>
  );
}
