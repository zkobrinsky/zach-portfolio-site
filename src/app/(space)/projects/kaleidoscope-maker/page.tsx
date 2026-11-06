import type { Metadata } from "next";
import { ProjectEmbed } from "@/components/ProjectEmbed";

export const metadata: Metadata = { title: "Kaleidoscope Maker | Zach Kobrinsky" };

export default function KaleidoscopeMakerPage() {
  return (
    <ProjectEmbed title="Kaleidoscope Maker" src="https://mandalas.herokuapp.com/">
      <p>A React app for creating kaleidoscopic art. The visuals are drawn with p5.js, and the controls run through Redux.</p>
      <p>This was my first React project in coding school, so forgive the god awful CSS.</p>
    </ProjectEmbed>
  );
}
