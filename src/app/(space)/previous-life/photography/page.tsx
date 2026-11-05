import type { Metadata } from "next";
import { PhotoGallery } from "@/components/PhotoGallery";
import { PHOTOS } from "@/lib/photos";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Photography | Zach Kobrinsky" };

export default function PhotographyPage() {
  return (
    <>
      <p className={styles.intro}>I used to work for National Geographic magazine.</p>
      <PhotoGallery photos={PHOTOS} />
    </>
  );
}
