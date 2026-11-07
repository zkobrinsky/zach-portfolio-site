"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Video } from "@/lib/videos";
import styles from "./VideoGallery.module.css";

/** A grid of videos. Selecting one opens it full screen, in Vimeo's player unless it's one of our own files. */
export function VideoGallery({ videos }: { videos: Video[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const viewer = useRef<HTMLDialogElement>(null);
  // only these open in the viewer, so stepping through it skips videos that can't play here
  const players = videos.filter((item) => !item.vimeoOnly);
  const video = open === null ? null : players[open];

  const step = (by: number) => setOpen((index) => (index === null ? null : (index + by + players.length) % players.length));

  useEffect(() => {
    const dialog = viewer.current;
    if (open !== null && !dialog?.open) dialog?.showModal();
    if (open === null && dialog?.open) dialog.close();
  }, [open]);

  return (
    <>
      <ul className={styles.grid}>
        {videos.map((item) => {
          const card = (
            <>
              <span className={styles.thumbnail}>
                <Image src={`/videos/${item.id}.jpg`} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw" />
              </span>
              <span className={styles.title}>{item.title}</span>
            </>
          );
          return (
            <li key={item.id}>
              {item.vimeoOnly ? (
                <a href={`https://vimeo.com/${item.id}`} target="_blank" rel="noopener noreferrer">
                  {card}
                </a>
              ) : (
                <button type="button" onClick={() => setOpen(players.indexOf(item))} aria-label={`Play ${item.title}`}>
                  {card}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <dialog
        ref={viewer}
        className={styles.viewer}
        aria-label="Video player"
        onClose={() => setOpen(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") step(1);
          if (event.key === "ArrowLeft") step(-1);
        }}
      >
        {video && (
          <>
            <figure>
              {/* keyed by video, so stepping starts a fresh player and closing stops the sound */}
              {video.file ? (
                <video key={video.id} src={video.file} aria-label={video.title} autoPlay muted loop playsInline controls />
              ) : (
                <iframe
                  key={video.id}
                  src={`https://player.vimeo.com/video/${video.id}?autoplay=1&title=0&byline=0&portrait=0`}
                  title={video.title}
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              )}
              <figcaption>
                <strong>{video.title}</strong>
                {video.caption}
              </figcaption>
            </figure>
            <button type="button" className={styles.previous} onClick={() => step(-1)} aria-label="Previous video">
              ‹
            </button>
            <button type="button" className={styles.next} onClick={() => step(1)} aria-label="Next video">
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
