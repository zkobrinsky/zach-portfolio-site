import type { Metadata } from "next";

export const metadata: Metadata = { title: "About | Zach Kobrinsky" };

export default function AboutPage() {
  return (
    <>
      <h2>About</h2>
      <p>
        Senior Frontend Engineer with 8+ years of experience building interactive 2D and 3D applications, complex UI
        systems, and visually rich web experiences. Two decades of experience in photography, visual storytelling,
        editorial production, and creative media, bringing a distinctive visual sensibility to frontend engineering and
        digital product development.
      </p>
      <p>Former National Geographic contributing photographer. Former newspaper editor. Former fishmonger.</p>
    </>
  );
}
