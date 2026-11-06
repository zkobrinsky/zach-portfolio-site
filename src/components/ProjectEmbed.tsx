import type { ReactNode } from "react";
import styles from "./Project.module.css";
import { ProjectOverlay } from "./ProjectOverlay";

type Props = { title: string; src: string; children: ReactNode };

/** A project hosted elsewhere, filling the page. */
export function ProjectEmbed({ title, src, children }: Props) {
  return (
    <>
      <iframe className={styles.embed} src={src} title={title} allow="autoplay; fullscreen" allowFullScreen />
      <ProjectOverlay title={title}>{children}</ProjectOverlay>
    </>
  );
}
