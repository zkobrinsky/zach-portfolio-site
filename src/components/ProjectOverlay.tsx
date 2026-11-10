"use client";

import { type ReactNode, useEffect, useState } from "react";
import styles from "./Project.module.css";

type Props = { title: string; onDismiss?: () => void; children: ReactNode };

/** An explanation over a live project. Clicking anywhere, the X, or Esc dismisses it, and the "i" button brings it back. */
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

  if (!explaining) {
    return (
      <button
        type="button"
        className={styles.reopen}
        aria-label={`About ${title}`}
        title={`About ${title}`}
        // keep the press from reaching the project underneath, which may listen on the whole window
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setExplaining(true);
        }}
      >
        i
      </button>
    );
  }
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
