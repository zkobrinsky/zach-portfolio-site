"use client";

import { type ReactNode, useEffect, useState } from "react";
import styles from "./Project.module.css";

type Props = { title: string; onDismiss?: () => void; children: ReactNode };

/** An explanation over a live project. Clicking anywhere, the X, or Esc dismisses it. */
export function ProjectOverlay({ title, onDismiss, children }: Props) {
  const [explaining, setExplaining] = useState(true);

  useEffect(() => {
    if (!explaining) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setExplaining(false);
      onDismiss?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [explaining, onDismiss]);

  if (!explaining) return null;
  return (
    <div
      className={styles.overlay}
      onClick={() => {
        setExplaining(false);
        onDismiss?.();
      }}
    >
      <section className={styles.panel} aria-label={`About ${title}`}>
        <button type="button" className={styles.close} aria-label="Close" autoFocus>
          ×
        </button>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}
