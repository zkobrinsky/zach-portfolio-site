"use client";

import Image from "next/image";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import type { Photo } from "@/lib/photos";
import styles from "./PhotoGallery.module.css";

/** How far a finger must travel to count as a swipe, in pixels. */
const SWIPE_DISTANCE = 50;
/** How much more sideways than vertical a swipe must be, so scrolling a caption never changes the photo. */
const SWIPE_STRAIGHTNESS = 1.5;

/** A grid of photos. Selecting one opens it full screen, with arrow keys or a swipe to move between them. */
export function PhotoGallery({ photos }: { photos: Photo[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const viewer = useRef<HTMLDialogElement>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const photo = open === null ? null : photos[open];

  const step = (by: number) => setOpen((index) => (index === null ? null : (index + by + photos.length) % photos.length));

  const beginSwipe = (event: PointerEvent) => {
    swiped.current = false;
    // a second finger means a pinch, not a swipe
    swipeStart.current = event.pointerType === "touch" && event.isPrimary ? { x: event.clientX, y: event.clientY } : null;
  };

  const endSwipe = (event: PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const across = event.clientX - start.x;
    const down = event.clientY - start.y;
    if (Math.abs(across) < SWIPE_DISTANCE || Math.abs(across) < Math.abs(down) * SWIPE_STRAIGHTNESS) return;
    swiped.current = true;
    step(across < 0 ? 1 : -1);
  };

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
        onPointerDown={beginSwipe}
        onPointerUp={endSwipe}
        onPointerCancel={() => (swipeStart.current = null)}
        onClick={(event) => {
          if (event.target === event.currentTarget && !swiped.current) setOpen(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") step(1);
          if (event.key === "ArrowLeft") step(-1);
        }}
      >
        {open !== null && photo && (
          <>
            <figure>
              <div className={styles.stage}>
                {/* The photos on either side load early and stay mounted, so stepping to one is instant.
                    Each is keyed by file, so an old photo can't linger while a new one loads. */}
                {[-1, 0, 1].map((offset) => {
                  const item = photos[(open + offset + photos.length) % photos.length];
                  return (
                    <Image
                      key={item.src}
                      src={item.src}
                      alt={offset === 0 ? item.alt : ""}
                      aria-hidden={offset !== 0}
                      fill
                      sizes="100vw"
                      loading="eager"
                      data-current={offset === 0}
                    />
                  );
                })}
              </div>
              {/* always the same height, so the photo doesn't jump between short and long captions */}
              <figcaption>
                {photo.title && <strong>{photo.title}</strong>}
                {photo.caption}
              </figcaption>
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
