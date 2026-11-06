import type p5 from "p5";
import type { SketchAudio } from "@/lib/audio/sketchAudio";

export type SketchContext = {
  audio: SketchAudio;
  /** The element the canvas lives in. It sets the size, since the page sits below the header. */
  host: HTMLElement;
  /** Aborts when the sketch leaves the page. */
  signal: AbortSignal;
};

export type Sketch = (context: SketchContext) => (p: p5) => void;

/** Calls back with the host's size whenever it changes. A hidden page measures zero, so that's skipped. */
export function followHost({ host, signal }: SketchContext, onSize: (width: number, height: number) => void) {
  const observer = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    if (width > 0 && height > 0) onSize(width, height);
  });
  observer.observe(host);
  signal.addEventListener("abort", () => observer.disconnect());
}

/** Space fills the sketch's own area, rather than the whole site as p5's fullscreen() would. */
export function toggleFullscreen(host: HTMLElement) {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void host.requestFullscreen();
}
