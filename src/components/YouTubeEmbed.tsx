import styles from "./YouTubeEmbed.module.css";

/** The privacy-enhanced player, which sets no cookies until someone presses play. */
export function YouTubeEmbed({ id, title }: { id: string; title: string }) {
  return (
    <iframe
      className={styles.video}
      src={`https://www.youtube-nocookie.com/embed/${id}`}
      title={title}
      loading="lazy"
      allow="fullscreen; picture-in-picture"
      allowFullScreen
    />
  );
}
