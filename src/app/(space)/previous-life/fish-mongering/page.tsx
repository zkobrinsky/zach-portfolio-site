import Image from "next/image";
import { pageMetadata } from "@/lib/seo";
import styles from "./page.module.css";

export const metadata = pageMetadata("/previous-life/fish-mongering");

export default function FishMongeringPage() {
  return (
    <div className={styles.story}>
      <h2>Fish Mongering</h2>
      <p>
        My first job when I moved to New York was as a fishmonger for Blue Moon Fish, the only fisherman who brought his catch
        straight to the greenmarkets. It was the best fish in New York City, and we supplied a lot of Michelin-rated
        restaurants and chefs.
      </p>
      <div className={styles.photos}>
        <figure>
          <Image
            src="/photos/fishmonger.jpg"
            alt="Zach Kobrinsky and Douglas Bradford sitting on a brick sidewalk, one in a Blue Moon Fish T-shirt"
            width={1200}
            height={1200}
            sizes="(max-width: 800px) 100vw, 28rem"
            loading="eager"
          />
          <figcaption>Me and my friend Douglas Bradford having a sit after a long day selling fish at Grand Army Plaza. He’s a QA engineer now!</figcaption>
        </figure>
        <figure>
          <Image
            src="/photos/blue-moon-fish-alex.jpg"
            alt="Alex Villani at the Blue Moon Fish market stand, laughing in a T-shirt that reads “Fish Worship: Is It Wrong?”"
            width={900}
            height={1200}
            sizes="(max-width: 800px) 100vw, 20rem"
            loading="eager"
          />
          <figcaption>Alex Villani, the proprietor of Blue Moon Fish and the kindest man I ever worked for, at the Tribeca Greenmarket.</figcaption>
        </figure>
        <figure>
          <Image
            src="/photos/blue-moon-fish-boaz.jpg"
            alt="Boaz in a Blue Moon Fish T-shirt, carrying a bright blue fish case at the market"
            width={900}
            height={1200}
            sizes="(max-width: 800px) 100vw, 20rem"
            loading="eager"
          />
          <figcaption>Boaz, at the Blue Moon Fish stand in the Tribeca Greenmarket.</figcaption>
        </figure>
      </div>
      <div className={styles.market}>
        <figure>
          <Image
            src="/photos/blue-moon-fish-aaron.jpg"
            alt="Aaron Quinn smiling as he shovels ice into a bright blue fish case at the market"
            width={1400}
            height={1050}
            sizes="(max-width: 800px) 100vw, 29rem"
          />
          <figcaption>Aaron Quinn, my fish mongering mentor, at the Tribeca Greenmarket.</figcaption>
        </figure>
        <figure>
          <video
            src="/videos/fish-stand-rain.mp4"
            poster="/videos/fish-stand-rain.jpg"
            aria-label="A heavy rainstorm at the Blue Moon Fish stand"
            controls
            playsInline
            preload="metadata"
          />
          <figcaption>A rainy day at the fish stand, Tribeca Greenmarket.</figcaption>
        </figure>
      </div>
    </div>
  );
}
