import { PhotoGallery } from "@/components/PhotoGallery";
import { PHOTOS } from "@/lib/photos";
import styles from "./page.module.css";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/previous-life/photography");

export default function PhotographyPage() {
  return (
    <>
      <p className={styles.intro}>I used to work for National Geographic magazine.</p>
      <PhotoGallery photos={PHOTOS} />
    </>
  );
}
