import { followHost, type Sketch, toggleFullscreen } from "./sketch";

/*
  Ported from the p5 sketch that visualized a 40-point pressure sensor worn on a pregnant belly. Each kick sent a
  ripple across the screen and rang a chord. The sensor came in over a serial port, so here a click stands in for it.
*/
const MAX_RIPPLES = 10;
/** Everything here is soft, so extra pixels add nothing. Matching a phone's 3x screen dropped it from 60 to 17 fps. */
const PIXEL_DENSITY = 1;
const RINGS = 5;
const RING_GAP = 0.1;
const TOP_COLOR = "rgb(40, 100, 200)";
const BOTTOM_COLOR = "rgb(80, 160, 255)";

type Ripple = { x: number; y: number; r: number; g: number; b: number; outerDiameter: number };

const babyKick: Sketch = (context) => (p) => {
  const { audio, host, signal } = context;
  const ripples: Ripple[] = [];
  let pointer: { x: number; y: number } | null = null;

  const paint = () => p.drawingContext as CanvasRenderingContext2D;

  const kick = (x: number, y: number) => {
    const [r, g, b] = [p.random(30, 240), p.random(30, 240), p.random(30, 240)].map(Math.round);
    ripples.push({ x, y, r, g, b, outerDiameter: 0 });
    if (ripples.length > MAX_RIPPLES) ripples.shift();
    audio.unlock();
    audio.playChord();
  };

  const drawBackground = () => {
    const canvas = paint();
    const gradient = canvas.createLinearGradient(0, 0, 0, p.height);
    gradient.addColorStop(0, TOP_COLOR);
    gradient.addColorStop(1, BOTTOM_COLOR);
    canvas.fillStyle = gradient;
    canvas.fillRect(0, 0, p.width, p.height);
  };

  const drawPointer = () => {
    if (!pointer) return;
    const canvas = paint();
    canvas.lineWidth = p.height * 0.005;
    canvas.strokeStyle = "rgb(255 255 255 / 0.5)";
    canvas.fillStyle = "#fff";
    canvas.beginPath();
    canvas.arc(pointer.x, pointer.y, p.height * 0.0075, 0, Math.PI * 2);
    canvas.fill();
    canvas.stroke();
  };

  // Straight to the canvas: p5's fill() and stroke() build a new color object on every call, up to 100 a frame.
  const drawRipple = ({ x, y, r, g, b, outerDiameter }: Ripple) => {
    const canvas = paint();
    canvas.lineWidth = p.height * 0.03;
    for (let ring = 0; ring < RINGS; ring++) {
      const diameter = outerDiameter - p.height * RING_GAP * ring;
      if (diameter <= 0) continue;
      // the fill fades out as it grows, and past that point the outline fades in
      const fade = 240 * (1 - diameter / (p.height * 0.5));
      canvas.beginPath();
      canvas.arc(x, y, diameter / 2, 0, Math.PI * 2);
      if (fade > 0) {
        canvas.fillStyle = `rgb(${r} ${g} ${b} / ${Math.min(fade / 255, 1)})`;
        canvas.fill();
      } else {
        canvas.strokeStyle = `rgb(${r} ${g} ${b} / ${Math.min((-fade * 0.2) / 255, 1)})`;
        canvas.stroke();
      }
    }
  };

  /** True once even the innermost ring has grown past every corner of the screen. */
  const isOffScreen = ({ outerDiameter }: Ripple) =>
    (outerDiameter - p.height * RING_GAP * (RINGS - 1)) / 2 > Math.hypot(p.width, p.height) + p.height * 0.03;

  p.setup = () => {
    p.pixelDensity(PIXEL_DENSITY);
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
    while (ripples.length > 0 && isOffScreen(ripples[0])) ripples.shift();
  };

  p.keyPressed = (event?: object) => {
    if (p.key === " " && (event as KeyboardEvent).target === document.body) toggleFullscreen(host);
  };
};

export default babyKick;
