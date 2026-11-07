import { ProjectSketch } from "@/components/ProjectSketch";
import { draftMetadata } from "@/lib/seo";

// a prototype: reachable by URL, but not in the nav and kept out of search results
export const metadata = draftMetadata("Improv Buddy");

export default function ImprovBuddyPage() {
  return (
    <ProjectSketch title="Improv Buddy" sketch="improv-buddy">
      <p>
        Play an instrument or sing, and a buddy plays along: it harmonizes the notes you hold, floats over your chords,
        and answers in the gaps you leave, in your key and in time once it finds your beat.
      </p>
      <p>It listens through your microphone. Headphones keep it from hearing itself.</p>
    </ProjectSketch>
  );
}
