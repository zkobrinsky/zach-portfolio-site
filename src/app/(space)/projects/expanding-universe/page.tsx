import { ProjectSketch } from "@/components/ProjectSketch";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/projects/expanding-universe");

export default function ExpandingUniversePage() {
  return (
    <ProjectSketch title="The Expanding Universe" sketch="expanding-universe">
      <p>
        The Expanding Universe is real scientific data analysis, made as art. Built with p5.js, it uses pixel manipulation
        to reveal evidence of our expanding universe in images from the COSMOS deep field of the Sloan Digital Sky
        Survey.
      </p>
      <p>
        Light from a galaxy moving away from us stretches toward red, an effect called red shift, while light from one
        moving toward us compresses toward blue. Hubble&apos;s Law shows that the farther away a galaxy is, the faster it
        recedes, which is how we know the universe is expanding. This piece compares the red and blue values of each pixel
        it samples, then isolates and amplifies them to separate red-shifted galaxies from blue-shifted ones, visually
        demonstrating factual evidence of our expanding universe.
      </p>
      <p>
        This project was a collaboration with{" "}
        <a href="https://cliu.us/" target="_blank" rel="noopener noreferrer">
          Dr. Charles Tsun-Chu Liu
        </a>{" "}
        of the American Museum of Natural History and the College of Staten Island, and{" "}
        <a href="https://astrofalcone.github.io" target="_blank" rel="noopener noreferrer">
          Dr. Julian Falcone
        </a>{" "}
        of the University of South Carolina. Dr. Liu confirmed the method is valid for galaxies, though not stars, so the
        analysis focuses on a deep field: a patch of sky with few stars in the way, where most of what you see is galaxies.
      </p>
      <p>
        It cycles through the views on its own. Press 0 for composite, 1 for red shift, 2 for blue shift, the right arrow
        for the next image, and space for fullscreen.
      </p>
    </ProjectSketch>
  );
}
