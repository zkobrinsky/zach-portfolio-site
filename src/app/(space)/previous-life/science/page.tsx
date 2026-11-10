import { draftMetadata } from "@/lib/seo";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import styles from "./page.module.css";

// TODO: move to pageMetadata("/previous-life/science") with a PAGES entry once the stories are written
export const metadata = draftMetadata("Science");

/** Stand-in for a story that hasn't been written yet. */
function Todo({ children }: { children: React.ReactNode }) {
  return <p className={styles.todo}>TODO: {children}</p>;
}

export default function SciencePage() {
  return (
    <div className={styles.story}>
      <h2>I’m a scientist… kind of</h2>
      <Todo>
        Intro: what I did, with links to the Smithsonian (TODO: URL) and BOLD (TODO: URL).
      </Todo>

      <h3>The plankton net</h3>
      <Todo>The story of my wife’s pantyhose.</Todo>
      <div className={styles.video}>
        <YouTubeEmbed id="EqnDa97vfyk" title="How to make a plankton net" />
      </div>

      <h3>James and the Gowanus Canal</h3>
      <Todo>The story. Photo with James, the squishy biologist, and the Bio Bus.</Todo>

      <h3>Moorea</h3>
      <Todo>Stories with Chris Meyer, Tom, and Pamela.</Todo>

      <h3>Ross School</h3>
      <Todo>Mahandry.</Todo>

      <h3>The mantis shrimp</h3>
      <Todo>Putting the mantis shrimp in freshwater.</Todo>

      <Todo>David has to come up somewhere.</Todo>

      <h3>People I worked with</h3>
      <Todo>Lynn Faust, Todd Oakley, and everyone else, with roles.</Todo>
    </div>
  );
}
