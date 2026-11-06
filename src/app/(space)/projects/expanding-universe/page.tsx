import type { Metadata } from "next";
import { ProjectSketch } from "@/components/ProjectSketch";

export const metadata: Metadata = { title: "The Expanding Universe | Zach Kobrinsky" };

export default function ExpandingUniversePage() {
  return (
    <ProjectSketch title="The Expanding Universe" sketch="expanding-universe">
      <p>
        Red shift is a phenomenon, similar to the Doppler effect, where galaxies moving away from us appear red and those
        moving toward us appear blue. This p5.js piece manipulates the pixel data of deep-field images from the Sloan
        Digital Sky Survey to show it happening.
      </p>
      <p>
        It cycles through the views on its own. Press 0 for composite, 1 for red shift, 2 for blue shift, the right arrow
        for the next image, and space for fullscreen.
      </p>
    </ProjectSketch>
  );
}
