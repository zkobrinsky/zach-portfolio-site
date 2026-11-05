import type { Metadata } from "next";

export const metadata: Metadata = { title: "About | Zach Kobrinsky" };

export default function AboutPage() {
  return (
    <>
      <h2>About</h2>
      <p>
        Frontend developer building highly interactive, often 3D, web experiences. Before that, a science and
        commercial photographer. At the heart of all my work is using emerging technology to tell compelling stories.
      </p>
    </>
  );
}
