import type p5 from "p5";
import * as Tone from "tone";
import { Buddy } from "@/lib/improv/buddy";
import { chordName } from "@/lib/improv/theory";
import { followHost, type Sketch } from "./sketch";

/*
  Improv Buddy: play an instrument or sing, and a buddy plays along. A piano roll drifts past a playhead:
  your notes in gold, the buddy's in teal, its next few notes faint ahead of the playhead. A faint beat grid
  appears once it has your tempo, and it says what it hears.
*/
const GOLD: [number, number, number] = [226, 176, 74];
const TEAL: [number, number, number] = [79, 195, 199];
const HISTORY_SECONDS = 9;
const PLAYHEAD = 0.72;
const STAR_COUNT = 240;

type Star = { x: number; y: number; size: number; depth: number; twinkle: number };

const sketch: Sketch = ({ audio, host, signal }) => (p: p5) => {
  let buddy: Buddy | null = null;
  let state: "waiting" | "starting" | "playing" | "no-mic" = "waiting";
  let low = 52;
  let high = 80;
  let stars: Star[] = [];
  let lastFrame = 0;
  const font = getComputedStyle(document.body).getPropertyValue("--font-mono").trim() || "monospace";

  const begin = async () => {
    if (state !== "waiting") return;
    state = "starting";
    try {
      await Tone.start();
      buddy = new Buddy();
      await buddy.start();
      if (signal.aborted) return buddy.dispose();
      state = "playing";
    } catch {
      buddy?.dispose();
      buddy = null;
      state = "no-mic";
    }
  };
  // the click that closes the explanation counts: browsers only allow sound and the mic after one
  window.addEventListener("pointerdown", begin, { signal });
  window.addEventListener("keydown", begin, { signal });
  // H: wearing headphones, so it stops filtering out its own sound
  window.addEventListener(
    "keydown",
    (event) => {
      if (event.key.toLowerCase() === "h" && buddy) buddy.listener.headphones = !buddy.listener.headphones;
    },
    { signal },
  );
  signal.addEventListener("abort", () => buddy?.dispose());

  const scatterStars = () => {
    stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * p.width,
      y: Math.random() * p.height,
      size: Math.random() < 0.06 ? 2.2 : 0.6 + Math.random() * 1.1,
      depth: 0.2 + Math.random() * 0.8,
      twinkle: Math.random() * Math.PI * 2,
    }));
  };

  p.setup = () => {
    p.createCanvas(Math.max(host.clientWidth, 1), Math.max(host.clientHeight, 1));
    p.textFont(font);
    scatterStars();
    followHost({ audio, host, signal }, (width, height) => {
      if (width === p.width && height === p.height) return;
      p.resizeCanvas(width, height);
      scatterStars();
    });
  };

  const glow = (color: [number, number, number], alpha: number, blur: number) => {
    const context = p.drawingContext as CanvasRenderingContext2D;
    context.shadowBlur = blur;
    context.shadowColor = `rgba(${color.join(",")},${alpha})`;
  };
  const noGlow = () => ((p.drawingContext as CanvasRenderingContext2D).shadowBlur = 0);

  const drawStars = (dt: number) => {
    noGlow();
    p.noStroke();
    const t = p.millis() / 1000;
    for (const star of stars) {
      // drifts left with time, like the piano roll, the nearer ones faster
      star.x -= dt * 6 * star.depth;
      if (star.x < 0) star.x += p.width;
      const shimmer = 0.55 + 0.45 * Math.sin(t * (0.6 + star.depth) + star.twinkle);
      p.fill(255, 255, 255, 120 * star.depth * shimmer);
      p.circle(star.x, star.y, star.size);
    }
  };

  const caption = (text: string, x: number, y: number, color: [number, number, number], alpha: number, size = 13) => {
    noGlow();
    p.noStroke();
    p.fill(...color, alpha);
    p.textSize(size);
    p.text(text, x, y);
  };

  p.draw = () => {
    const dt = Math.min(0.1, (p.millis() - lastFrame) / 1000);
    lastFrame = p.millis();
    p.background(5, 5, 9);
    drawStars(dt);

    if (state !== "playing" || !buddy) {
      p.textAlign(p.CENTER, p.CENTER);
      const message =
        state === "no-mic"
          ? "couldn't open the microphone · check the browser's permission and reload"
          : state === "starting"
            ? "opening the microphone…"
            : "click anywhere to start jamming";
      caption(message, p.width / 2, p.height / 2, TEAL, 210, 16);
      if (state === "waiting") caption("it listens through your mic · headphones keep it from hearing itself", p.width / 2, p.height / 2 + 28, [180, 180, 190], 140, 12);
      p.textAlign(p.LEFT, p.BASELINE);
      return;
    }

    const now = Tone.immediate();
    buddy.voice.muted = audio.isSilent();
    buddy.update(now);

    const playhead = p.width * PLAYHEAD;
    const perSecond = playhead / HISTORY_SECONDS;
    const x = (time: number) => playhead + (time - now) * perSecond;
    const earliest = now - HISTORY_SECONDS;

    // the pitch range follows what's on screen, easing so it never jumps
    const onScreen: number[] = [];
    for (const played of buddy.played) if ((played.end ?? now) > earliest) onScreen.push(...played.pitches);
    for (const note of buddy.voice.notes) if ((note.end ?? now) > earliest) onScreen.push(note.midi);
    if (buddy.listener.live.midi !== null) onScreen.push(buddy.listener.live.midi);
    const wantLow = onScreen.length ? Math.min(...onScreen) - 4 : 52;
    const wantHigh = onScreen.length ? Math.max(...onScreen) + 4 : 80;
    const span = Math.max(24, wantHigh - wantLow);
    const middle = (wantLow + wantHigh) / 2;
    low += (middle - span / 2 - low) * Math.min(1, dt * 1.5);
    high += (middle + span / 2 - high) * Math.min(1, dt * 1.5);
    const top = p.height * 0.14;
    const bottom = p.height * 0.86;
    const y = (midi: number) => p.map(midi, low, high, bottom, top);
    const thickness = Math.max(5, Math.min(14, ((bottom - top) / (high - low)) * 0.8));

    // the beat: barely-there lines, fading in once it has locked, brighter on each bar
    const beat = buddy.beat;
    if (beat.period && beat.lockedAt !== null) {
      const fade = Math.min(1, (now - beat.lockedAt) / 1.5);
      noGlow();
      for (let n = Math.ceil(beat.position(earliest)); n <= beat.position(now + (p.width - playhead) / perSecond); n++) {
        const bx = x(beat.anchor + n * beat.period);
        const bar = ((n % 4) + 4) % 4 === 0;
        p.stroke(150, 170, 220, (bar ? 34 : 14) * fade);
        p.strokeWeight(bar ? 1.4 : 1);
        p.line(bx, top - 20, bx, bottom + 20);
      }
    }

    p.noStroke();
    // your notes
    for (const played of buddy.played) {
      const end = played.end ?? now;
      if (end < earliest) continue;
      const chord = played.kind === "chord";
      for (const midi of played.pitches) {
        glow(GOLD, chord ? 0.4 : 0.8, chord ? 10 : 18);
        p.fill(...GOLD, chord ? 120 : 235);
        p.rect(x(played.start), y(midi) - thickness / 2, Math.max(3, x(end) - x(played.start)), thickness, thickness / 2);
      }
      if (chord) caption(chordName(played.chord!), x(played.start), y(Math.max(...played.pitches)) - thickness - 6, GOLD, 170, 11);
      // a soft bloom as each note begins
      const age = now - played.start;
      if (age < 0.7) {
        noGlow();
        p.noFill();
        p.stroke(...GOLD, 160 * (1 - age / 0.7));
        p.strokeWeight(1.5);
        p.circle(x(played.start), y(played.pitches[0]), 10 + age * 70);
        p.noStroke();
      }
    }

    // the buddy's notes, the planned ones faint ahead of the playhead
    for (const note of buddy.voice.notes) {
      const end = note.end ?? now;
      if (end < earliest || note.start > now + (p.width - playhead) / perSecond) continue;
      const ahead = note.planned || note.start > now;
      glow(TEAL, ahead ? 0 : 0.8, ahead ? 0 : 16);
      p.fill(...TEAL, ahead ? 70 : note.role === "harmony" ? 190 : 230);
      const right = note.end === null ? x(now) : x(end);
      p.rect(x(note.start), y(note.midi) - thickness / 2, Math.max(3, right - x(note.start)), thickness, thickness / 2);
    }

    // the playhead, and what it hears this very moment
    noGlow();
    p.stroke(255, 255, 255, 90);
    p.strokeWeight(1);
    p.line(playhead, top - 30, playhead, bottom + 30);
    p.noStroke();
    const live = buddy.listener.live;
    if (live.midi !== null) {
      glow(GOLD, 0.9, 22);
      p.fill(...GOLD, 255);
      p.circle(playhead, y(live.midi), 8 + Math.min(10, live.loudness * 120));
    }

    // what it says
    p.textAlign(p.LEFT, p.BASELINE);
    const left = 22;
    let line = 34;
    if (!beat.locked) {
      // a slow "listening" pulse until it has the beat
      const pulse = 0.5 + 0.5 * Math.sin(p.millis() / 380);
      noGlow();
      p.noFill();
      p.stroke(...TEAL, 90 + 90 * pulse);
      p.circle(left + 5, line - 4, 8 + pulse * 5);
      p.noStroke();
      caption(buddy.status, left + 20, line, TEAL, 200);
    } else caption(buddy.status, left, line, TEAL, 200);
    line += 20;
    if (beat.bpm) {
      caption(`${beat.bpm} bpm`, left, line, [180, 190, 210], 140, 12);
      line += 18;
    }
    if (buddy.keyLabel) caption(buddy.keyLabel, left, line, [180, 190, 210], 140, 12);

    if (buddy.flash && now - buddy.flash.at < 2.8) {
      p.textAlign(p.CENTER, p.BASELINE);
      const fade = 1 - Math.max(0, now - buddy.flash.at - 1.6) / 1.2;
      caption(buddy.flash.text, p.width / 2, top - 30, TEAL, 230 * fade, 16);
    }

    p.textAlign(p.LEFT, p.BASELINE);
    caption("■ you", left, p.height - 22, GOLD, 170, 12);
    caption("■ buddy", left + 62, p.height - 22, TEAL, 170, 12);
    caption(
      buddy.listener.headphones ? "headphones on · press H if you take them off" : "on speakers · press H if you're wearing headphones",
      left + 140,
      p.height - 22,
      [150, 150, 160],
      110,
      12,
    );
  };
};

export default sketch;
