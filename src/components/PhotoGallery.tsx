"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Photo } from "@/lib/photos";
import styles from "./PhotoGallery.module.css";

/** A grid of photos. Selecting one opens it full screen, with arrow keys to move between them. */
export function PhotoGallery({ photos }: { photos: Photo[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const viewer = useRef<HTMLDialogElement>(null);
  const photo = open === null ? null : photos[open];

  const step = (by: number) => setOpen((index) => (index === null ? null : (index + by + photos.length) % photos.length));

  useEffect(() => {
    const dialog = viewer.current;
    if (open !== null && !dialog?.open) dialog?.showModal();
    if (open === null && dialog?.open) dialog.close();
  }, [open]);

  return (
    <>
      <ul className={styles.grid}>
        {photos.map((item, index) => (
          <li key={item.src}>
            <button type="button" onClick={() => setOpen(index)} aria-label={`View ${item.alt}`}>
              <Image src={item.src} alt={item.alt} fill sizes="(max-width: 640px) 50vw, (max-width: 1100px) 33vw, 25vw" />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={viewer}
        className={styles.viewer}
        aria-label="Photo viewer"
        onClose={() => setOpen(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") step(1);
          if (event.key === "ArrowLeft") step(-1);
        }}
      >
        {photo && (
          <>
            <figure>
              <Image src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} sizes="100vw" priority />
              {photo.title && (
                <figcaption>
                  <strong>{photo.title}</strong>
                  {photo.caption}
                </figcaption>
              )}
            </figure>
            <button type="button" className={styles.previous} onClick={() => step(-1)} aria-label="Previous photo">
              ‹
            </button>
            <button type="button" className={styles.next} onClick={() => step(1)} aria-label="Next photo">
              ›
            </button>
            <button type="button" className={styles.close} onClick={() => setOpen(null)} aria-label="Close">
              ×
            </button>
          </>
        )}
      </dialog>
    </>
  );
}
