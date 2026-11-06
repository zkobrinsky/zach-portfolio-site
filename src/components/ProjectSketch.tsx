"use client";

import type p5 from "p5";
import { type ReactNode, use, useEffect, useRef, useState } from "react";
import { createSketchAudio } from "@/lib/audio/sketchAudio";
import { SilentContext } from "@/lib/audio/SilentContext";
import styles from "./Project.module.css";
import { ProjectOverlay } from "./ProjectOverlay";

// loaded on demand, so p5 only reaches visitors who open one of these pages
const SKETCHES = {
  "expanding-universe": () => import("@/lib/sketches/expandingUniverse"),
  "baby-kick": () => import("@/lib/sketches/babyKick"),
};

type Props = { title: string; sketch: keyof typeof SKETCHES; children: ReactNode };

/** A p5 sketch running on the page, filling the area below the header. */
export function ProjectSketch({ title, sketch, children }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [audio] = useState(createSketchAudio);
  const silent = use(SilentContext);

  useEffect(() => audio.setSilent(silent), [audio, silent]);

  useEffect(() => {
    const stage = host.current;
    if (!stage) return;
    const lifetime = new AbortController();
    let instance: p5 | undefined;
    void Promise.all([import("p5"), SKETCHES[sketch]()]).then(([{ default: P5 }, { default: create }]) => {
      if (lifetime.signal.aborted) return;
      instance = new P5(create({ audio, host: stage, signal: lifetime.signal }), stage);
    });
    return () => {
      lifetime.abort();
      instance?.remove();
      audio.stop();
    };
  }, [audio, sketch]);

  return (
    <>
      <div ref={host} className={styles.stage} />
      <ProjectOverlay title={title} onDismiss={audio.unlock}>
        {children}
      </ProjectOverlay>
    </>
  );
}
