import { pageMetadata } from "@/lib/seo";
import styles from "./page.module.css";

export const metadata = pageMetadata("/previous-life/newspaper-editor");

export default function NewspaperEditorPage() {
  return (
    <div className={styles.story}>
      <h2>Newspaper Editor</h2>
      <p>
        I was the editor in chief and photo editor of the{" "}
        <a href="https://hpr1.com/" target="_blank" rel="noopener noreferrer">
          High Plains Reader
        </a>
        .
      </p>
      <p>
        It was the early days of the internet, so nothing digital really survived. To see the work, you’ll have to go to my
        brother’s garage in North Dakota and dig up my old print archives.
      </p>
    </div>
  );
}
