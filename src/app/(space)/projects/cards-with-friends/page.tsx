import Image from "next/image";
import styles from "./page.module.css";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/projects/cards-with-friends");

export default function CardsWithFriendsPage() {
  return (
    <div className={styles.project}>
      <div className={styles.backdrop}>
        <Image src="/projects/cards-with-friends.jpg" alt="" fill sizes="100vw" loading="eager" />
      </div>
      <h2>Cards with Friends</h2>
      <p>
        A free, browser-based card game platform for people who actually know each other. Nothing to install and no
        account to create: open a link, pick a name, and you&apos;re at the table.
      </p>
      <h3>The technical work</h3>
      <ul>
        <li>Built with Nuxt and Vue.</li>
        <li>Games run in real time over WebSockets, so a played card moves for everyone at the table instantly.</li>
        <li>Every room has live video and audio built in, because half of playing cards is watching people&apos;s faces.</li>
        <li>Rooms are lightweight and disposable: create one, share the link, and it cleans itself up afterward.</li>
        <li>Crazy 8s, War, Durak, Cribbage, Solitaire, Social Solitaire, Garbage and Rummy, each with the real rules of the physical game.</li>
      </ul>
      <a href="https://www.cardswithfriends.fun/" target="_blank" rel="noopener noreferrer">
        Open Cards with Friends
      </a>
    </div>
  );
}
