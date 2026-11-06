import { ProjectSketch } from "@/components/ProjectSketch";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/projects/baby-kick-sensor");

export default function BabyKickSensorPage() {
  return (
    <ProjectSketch title="Baby Kick Sensor" sketch="baby-kick">
      <p>
        When my wife was first pregnant, I was in grad school, so I made this visualization of baby kicks on my wife&apos;s
        belly (click to emulate a baby kick)
      </p>
      <YouTubeEmbed id="NVR3bVjGojk" title="Winter Show 2019 pitch for the baby kick sensor" />
    </ProjectSketch>
  );
}
