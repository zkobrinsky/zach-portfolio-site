import { hostedAsset } from "@/lib/assets";
import { followHost, type Sketch, toggleFullscreen } from "./sketch";

/*
  Ported from github.com/zkobrinsky/expanding-universe.

  Each frame samples 1,000 random pixels from a Sloan Digital Sky Survey image and redraws them as dots, so the
  picture slowly assembles itself. The modes then isolate red-shifted and blue-shifted galaxies.
*/
const IMAGE_COUNT = 700;
/** Gaps in the numbering, where the survey download failed. */
const MISSING_IMAGES = new Set([528, 535, 562, 575, 579, 584, 692, 698]);
const RETRY_MS = 2000;

const COMPOSITE = 0;
const RED_SHIFT = 1;
const BLUE_SHIFT = 2;
const SECONDS_PER_MODE = 20;

const HEIGHT_RATIO = 0.56;
const DOTS_PER_FRAME = 1000;
const SHIFT_MAGNITUDE = 6;
const FRAME_RATE = 45;

const fit = (width: number, height: number) => {
  const fitted = Math.min(width, height / HEIGHT_RATIO);
  return [Math.floor(fitted), Math.floor(fitted * HEIGHT_RATIO)] as const;
};

const expandingUniverse: Sketch = (context) => (p) => {
  const { audio, host, signal } = context;
  let sky: { pixels: number[]; width: number; height: number } | null = null;
  let mode = COMPOSITE;
  let modeTimer: ReturnType<typeof setInterval>;
  let framesUntilNote = 0;

  const rollNextNote = () => {
    framesUntilNote = Math.floor(p.random(200, 400));
  };
  const playChord = () => {
    audio.playChord();
    rollNextNote();
  };

  const nextMode = () => {
    mode++;
    if (mode > BLUE_SHIFT) loadSky();
    else playChord();
  };
  const restartModeTimer = () => {
    clearInterval(modeTimer);
    modeTimer = setInterval(nextMode, SECONDS_PER_MODE * 1000);
  };
  signal.addEventListener("abort", () => clearInterval(modeTimer));

  const setMode = (next: number) => {
    mode = next;
    restartModeTimer();
    playChord();
  };

  function loadSky() {
    let id: number;
    do id = Math.floor(p.random(IMAGE_COUNT));
    while (MISSING_IMAGES.has(id));
    p.loadImage(
      hostedAsset(`/sketches/expanding-universe/img${id}.jpg`),
      (image) => {
        if (signal.aborted) return;
        // read once here: the original read all 2 million pixels again on every frame
        image.loadPixels();
        sky = { pixels: image.pixels, width: image.width, height: image.height };
        setMode(COMPOSITE);
      },
      () => {
        if (!signal.aborted) setTimeout(loadSky, RETRY_MS);
      },
    );
  }

  const drawDot = ({ pixels, width, height }: NonNullable<typeof sky>) => {
    const x = Math.floor(p.random(width));
    const y = Math.floor(p.random(height));
    const offset = (y * width + x) * 4;
    let r = pixels[offset];
    let g = pixels[offset + 1];
    let b = pixels[offset + 2];
    let alpha = 240;

    if (mode === RED_SHIFT) {
      alpha = 200;
      if (r > b) r *= SHIFT_MAGNITUDE;
      else if (r < b) [r, g, b] = [r / 2, 0, 0];
    }
    if (mode === BLUE_SHIFT) {
      alpha = 200;
      if (b > r) [r, b] = [0, (b * SHIFT_MAGNITUDE) / 2];
      else if (b < r) [r, g, b] = [0, 0, 0];
    }

    p.fill(r, g, b, alpha);
    p.circle(p.map(x, 0, width, 0, p.width), p.map(y, 0, height, 0, p.height), p.width / p.random(200, 375));
  };

  p.setup = () => {
    p.createCanvas(...fit(Math.max(host.clientWidth, 1), Math.max(host.clientHeight, 1)));
    p.frameRate(FRAME_RATE);
    p.background(0);
    p.noStroke();
    p.noCursor();
    rollNextNote();
    followHost(context, (width, height) => {
      const [fittedWidth, fittedHeight] = fit(width, height);
      if (fittedWidth === p.width && fittedHeight === p.height) return;
      p.resizeCanvas(fittedWidth, fittedHeight);
      p.background(0);
      p.noStroke();
    });
    restartModeTimer();
    loadSky();
    audio.whenAudible(playChord);
  };

  p.draw = () => {
    if (--framesUntilNote <= 0) {
      audio.playNote();
      rollNextNote();
    }
    if (!sky) return;
    for (let i = 0; i < DOTS_PER_FRAME; i++) drawDot(sky);
  };

  p.keyPressed = (event?: object) => {
    const key = p.key;
    if (key === " " && (event as KeyboardEvent).target === document.body) toggleFullscreen(host);
    if (!["0", "1", "2", "ArrowRight"].includes(key)) return;
    audio.unlock();
    if (key === "ArrowRight") loadSky();
    else setMode(Number(key));
  };
};

export default expandingUniverse;
