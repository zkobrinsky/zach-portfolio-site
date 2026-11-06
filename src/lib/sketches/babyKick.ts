import { followHost, type Sketch, toggleFullscreen } from "./sketch";

/*
  Ported from the p5 sketch that visualized a 40-point pressure sensor worn on a pregnant belly. Each kick sent a
  ripple across the screen and rang a chord. The sensor came in over a serial port, so here a click stands in for it.
*/
const MAX_RIPPLES = 10;
const RINGS = 5;
const TOP_COLOR = "rgb(40, 100, 200)";
const BOTTOM_COLOR = "rgb(80, 160, 255)";

type Ripple = { x: number; y: number; r: number; g: number; b: number; outerDiameter: number };

const babyKick: Sketch = (context) => (p) => {
  const { audio, host, signal } = context;
  const ripples: Ripple[] = [];
  let pointer: { x: number; y: number } | null = null;

  const kick = (x: number, y: number) => {
    const [r, g, b] = [p.random(30, 240), p.random(30, 240), p.random(30, 240)];
    ripples.push({ x, y, r, g, b, outerDiameter: 0 });
    if (ripples.length > MAX_RIPPLES) ripples.shift();
    audio.unlock();
    audio.playChord();
  };

  const drawBackground = () => {
    const canvas = p.drawingContext as CanvasRenderingContext2D;
    const gradient = canvas.createLinearGradient(0, 0, 0, p.height);
    gradient.addColorStop(0, TOP_COLOR);
    gradient.addColorStop(1, BOTTOM_COLOR);
    canvas.save();
    canvas.fillStyle = gradient;
    canvas.fillRect(0, 0, p.width, p.height);
    canvas.restore();
  };

  const drawPointer = () => {
    if (!pointer) return;
    p.strokeWeight(p.height * 0.005);
    p.stroke(255, 255, 255, 128);
    p.fill(255);
    p.circle(pointer.x, pointer.y, p.height * 0.015);
  };

  const drawRipple = ({ x, y, r, g, b, outerDiameter }: Ripple) => {
    for (let ring = 0; ring < RINGS; ring++) {
      const diameter = outerDiameter - p.height * 0.1 * ring;
      if (diameter <= 0) continue;
      // the fill fades out as it grows, and past that point the outline fades in
      const fade = p.map(diameter, 0, p.height * 0.5, 240, 0);
      p.strokeWeight(p.height * 0.03);
      p.stroke(r, g, b, -fade * 0.2);
      p.fill(r, g, b, fade);
      p.circle(x, y, diameter);
    }
  };

  p.setup = () => {
    const canvas = p.createCanvas(Math.max(host.clientWidth, 1), Math.max(host.clientHeight, 1)).elt as HTMLCanvasElement;
    p.noCursor();
    followHost(context, (width, height) => {
      if (width !== p.width || height !== p.height) p.resizeCanvas(width, height);
    });

    // on the canvas, because p5's own mousePressed also fires for clicks on the overlay and the header
    canvas.addEventListener("pointerdown", (event) => kick(event.offsetX, event.offsetY), { signal });
    canvas.addEventListener(
      "pointermove",
      (event) => {
        if (event.pointerType === "mouse") pointer = { x: event.offsetX, y: event.offsetY };
      },
      { signal },
    );
    canvas.addEventListener("pointerleave", () => (pointer = null), { signal });

    audio.whenAudible(audio.startDrone);
  };

  p.draw = () => {
    drawBackground();
    drawPointer();
    for (const ripple of ripples) {
      drawRipple(ripple);
      ripple.outerDiameter += p.height * 0.0062;
    }
  };

  p.keyPressed = (event?: object) => {
    if (p.key === " " && (event as KeyboardEvent).target === document.body) toggleFullscreen(host);
  };
};

export default babyKick;
