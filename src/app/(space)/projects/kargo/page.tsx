import Image from "next/image";
import { FlourishGallery } from "@/components/FlourishGallery";
import { pageMetadata } from "@/lib/seo";
import styles from "./page.module.css";

export const metadata = pageMetadata("/projects/kargo");

export default function KargoPage() {
  return (
    <div className={styles.project}>
      <Image className={styles.logo} src="/projects/kargo-logo.svg" alt="Kargo" width={214} height={80} unoptimized />
      <h2>Kargo Flourishes</h2>
      <p>
        I was the Tech Lead on Flourishes, interactive elements added to open-web and PMP banner ads to increase engagement,
        driving CTR lifts of up to 160%. I worked on this closely with my fantastic colleague Alex Armknecht.
      </p>
      <div className={styles.challenges}>
        <h3>The technical challenges</h3>
        <h4>Matching any brand, automatically</h4>
        <p>
          A flourish has to feel like part of the ad it’s attached to, and it has no idea what that ad will be. So I built a
          dynamic color-extraction pipeline that finds the visual assets in a creative and runs color quantization on them to
          pull out its palette. Getting at those pixels meant navigating CORS restrictions across a wide range of creative
          formats. Open Graph metadata filled in advertiser-specific styling.
        </p>
        <h4>Shipping in a day, not two weeks</h4>
        <p>
          Flourishes started out as an S3-hosted CSS lookup, so every new design meant a slow release. I migrated it to a
          manifest system that bundles configuration, CTA text, CSS, and JavaScript together. That cut deployment time from 1.5–2
          weeks to one day, and eliminated ad-tag releases entirely.
        </p>
        <h4>Working everywhere</h4>
        <p>
          These run on publisher pages we don’t control, across a huge range of ad sizes and formats. Tracking down production
          issues meant going straight to the live pages with browser DevTools, network inspection, and DOM analysis.
        </p>
      </div>
      <p>Select any one below to see it live.</p>
      <FlourishGallery />
    </div>
  );
}
