import type { Metadata } from "next";
import { ProjectSketch } from "@/components/ProjectSketch";

export const metadata: Metadata = { title: "Baby Kick Sensor | Zach Kobrinsky" };

export default function BabyKickSensorPage() {
  return (
    <ProjectSketch title="Baby Kick Sensor" sketch="baby-kick">
      <p>
        When my wife was first pregnant, I was in grad school, so I made this visualization of baby kicks on my wife&apos;s
        belly (click to emulate a baby kick)
      </p>
    </ProjectSketch>
  );
}
