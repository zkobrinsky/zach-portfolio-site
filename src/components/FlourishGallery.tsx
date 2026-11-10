"use client";

import Image from "next/image";
import { useState } from "react";
import { FLOURISHES, type Flourish } from "@/lib/flourishes";
import styles from "@/app/(space)/projects/kargo/page.module.css";

const SECTIONS: { heading: string; kind: Flourish["kind"] }[] = [
  { heading: "Display", kind: "display" },
  { heading: "Video", kind: "video" },
];

/** Display flourishes the color toggle has no effect on. */
const NO_COLOR_MATCH = new Set(["d-expand-liquid-content"]);

/** Display demos bury their color toggle on phones, so links set it directly. Video demos don't have one. */
const demoUrl = ({ id, url, kind }: Flourish, matchColors: boolean) =>
  kind === "display" && matchColors && !NO_COLOR_MATCH.has(id) ? `${url}&flourish_color_picker=1` : url;

/** Fits an ad inside its 3:4 tile, so the frame hugs the ad and its corners and shadow land on the ad's edges. */
const TILE_RATIO = 3 / 4;
const frameSize = (width: number, height: number) => ({
  width: `${Math.min(1, width / height / TILE_RATIO) * 100}%`,
  aspectRatio: `${width} / ${height}`,
});

/** Cards linking to each live demo, with a switch for the color extraction described above them. */
export function FlourishGallery() {
  const [matchColors, setMatchColors] = useState(true);

  return (
    <>
      {SECTIONS.map(({ heading, kind }) => (
        <section key={kind}>
          <h3>{heading}</h3>
          {kind === "display" && (
            <div className={styles.switchRow}>
              <button
                type="button"
                role="switch"
                aria-checked={matchColors}
                className={styles.switch}
                onClick={() => setMatchColors(!matchColors)}
              >
                <span className={styles.track} aria-hidden>
                  <span className={styles.thumb} />
                </span>
                Match the ad’s colors: {matchColors ? "On" : "Off"}
              </button>
              <p>
                {matchColors
                  ? "Display demos pull their colors from the ad, live (except Liquid)."
                  : "Display demos use their default colors, with no color extraction."}
              </p>
            </div>
          )}
          {kind === "video" && (
            <p className={styles.sectionNote}>Color matching is display-only. Video flourishes always use their default colors.</p>
          )}
          <ul className={styles.grid}>
            {FLOURISHES.filter((flourish) => flourish.kind === kind).map((flourish) => {
              const { id, label, width, height } = flourish;
              return (
                <li key={id}>
                  <a href={demoUrl(flourish, matchColors)} target="_blank" rel="noopener noreferrer">
                    <span className={styles.preview}>
                      <span className={styles.frame} style={frameSize(width, height)}>
                        <Image
                          src={`/projects/flourishes/${id}.jpg`}
                          alt=""
                          width={width}
                          height={height}
                          sizes="(max-width: 640px) 50vw, 15rem"
                        />
                      </span>
                    </span>
                    <span className={styles.label}>
                      {label}
                      <span className={styles.tryIt}>Try it →</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
