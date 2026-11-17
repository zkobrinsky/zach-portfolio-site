import { PitchDetector } from "pitchy";
import * as Tone from "tone";
import { log } from "./debug";
import { hearInKey } from "./key";
import { type Chord, chordName, hzToMidi, matchChord, noteName, pitchClass } from "./theory";

/*
  Hears the player. Two detectors run on the mic side by side: pitchy (McLeod pitch method) for the exact note
  of a single voice or instrument, and a chroma, which folds the spectrum into 12 pitch classes, for chords.
  The raw stream becomes events: a note or chord with a start and, once it stops, an end.
*/
const WAVE_SIZE = 2048;
const FFT_SIZE = 8192;
/** Below this loudness (RMS), it's not playing. Rises with a noisy room. */
const MIN_GATE = 0.006;
/** How sure pitchy has to be to call it a single note. */
const NOTE_CLARITY = 0.88;
/**
 * A chord muddies pitchy's reading far below this. Anything clearer is one voice or instrument whose
 * overtones (an octave, a fifth, a third up) look like a chord to the chroma, so it isn't called one.
 */
const CHORD_MAX_CLARITY = 0.6;
/**
 * The room's noise is the quietest tenth of the last few seconds: every phrase has gaps, so that's silence,
 * however loud the room. A note has to be this many times louder to count; a chord, much louder, because
 * room noise through the chroma looks like a random chord.
 */
const FLOOR_SECONDS = 5;
const FLOOR_PERCENTILE = 0.1;
const NOTE_OVER_FLOOR = 1.4;
const CHORD_OVER_FLOOR = 3;
/** Once on a note, the pitch has to wander this far (in semitones) to count as a new one, so vibrato holds. */
const NOTE_HOLD = 0.75;
/** Its own sound only gets ignored when the mic is no louder than this many times its usual bleed. */
const BLEED_MARGIN = 2;
const LOWEST_HZ = 55;
const HIGHEST_HZ = 1500;
/** Frames a new pitch must hold before it counts, so slides and wobbles don't spray notes. */
const NOTE_SETTLE_FRAMES = 6;
const CHORD_SETTLE_FRAMES = 6;
/** Frames of quiet before a note is over. */
const RELEASE_FRAMES = 5;
/** Only frames this clear count toward where a held note really sits; slides and breathy frames don't. */
const STEADY_CLARITY = 0.9;
/** A jump in loudness this big on the same pitch is a new attack, like re-plucking a string. */
const REATTACK_RATIO = 1.9;

export type Played = {
  id: number;
  kind: "note" | "chord";
  /** The note, or every note of the chord, placed near middle C for drawing. */
  pitches: number[];
  /** A note's pitch as you actually held it (MIDI, fractional, on the A440 grid), once it's over. */
  exact: number | null;
  /** How it ended: you went quiet, or it ran straight into another note (as a slide or scoop does). */
  endedBy: "quiet" | "change" | null;
  chord: Chord | null;
  label: string;
  start: number;
  end: number | null;
  loudness: number;
};

/** What's sounding right now, frame by frame, before it settles into an event. Drawn as a live marker. */
export type Live = { midi: number | null; chord: Chord | null; loudness: number };

type Candidate = { key: string; kind: "note" | "chord"; midi: number | null; chord: Chord | null } | null;

export type ListenerEvents = {
  onStart: (played: Played) => void;
  onEnd: (played: Played) => void;
  /** Pitch classes the buddy is sounding right now, so it never mistakes itself for the player. */
  ownPitchClasses: () => Set<number>;
  /**
   * How to hear you: your tuning (semitones off A440), and once the key is known, its scale, so a loosely
   * sung note is heard as the note of the key it's nearest.
   */
  hearing: () => { tuning: number; scale: number[] | null };
};

export class Listener {
  readonly live: Live = { midi: null, chord: null, loudness: 0 };
  current: Played | null = null;
  /** The loudness a sound needs to count as playing, for debugging. */
  gate = MIN_GATE;
  /** Clear readings of the note being held, to find where it really sits. */
  private steady: number[] = [];
  /** With headphones the mic can't hear the buddy, so there's nothing to filter out. */
  headphones = false;

  private mic = new Tone.UserMedia();
  private wave = new Tone.Analyser("waveform", WAVE_SIZE);
  private spectrum = new Tone.Analyser({ type: "fft", size: FFT_SIZE, smoothing: 0.4 });
  private detector = PitchDetector.forFloat32Array(WAVE_SIZE);
  private chroma = new Array<number>(12).fill(0);
  private noiseFloor = MIN_GATE;
  private recentLoudness: number[] = [];
  private frame = 0;
  private chordGate = MIN_GATE;
  /** How loud the buddy usually is in the mic, measured while it plays and you don't. */
  private bleed = 0;
  /** Its own pitch classes this frame, or empty when it can't be heard (headphones, or you're much louder). */
  private own = new Set<number>();
  private lastLoudness = 0;
  private pending: Candidate = null;
  private pendingFrames = 0;
  /** When the pitch now waiting to settle first appeared: the note's real start, for timing. */
  private pendingSince = 0;
  /** When you started moving off the current note, if you have: a slide's start. */
  private leftAt: number | null = null;
  private quietFrames = 0;
  private nextId = 1;
  private lastFinish = -Infinity;
  /** Debug: pitchy's raw reading this frame. */
  private reading = { hz: 0, clarity: 0, strong: 0 };

  constructor(private events: ListenerEvents) {
    this.mic.connect(this.wave);
    this.mic.connect(this.spectrum);
  }

  open() {
    return this.mic.open();
  }

  /** Call once a frame with the audio clock's time. */
  update(now: number) {
    const wave = this.wave.getValue() as Float32Array;
    let sum = 0;
    for (const sample of wave) sum += sample * sample;
    const loudness = Math.sqrt(sum / wave.length);
    // The floor sinks straight to quiet moments, and creeps up only while you're not playing, so it learns the
    // room and not the music. Otherwise steady playing raises the gate until it can't hear you.
    this.recentLoudness.push(loudness);
    if (this.recentLoudness.length > FLOOR_SECONDS * 60) this.recentLoudness.shift();
    if (this.frame++ % 10 === 0) {
      const sorted = [...this.recentLoudness].sort((a, b) => a - b);
      this.noiseFloor = sorted[Math.floor(sorted.length * FLOOR_PERCENTILE)];
    }
    const gate = Math.max(MIN_GATE, this.noiseFloor * NOTE_OVER_FLOOR);
    this.chordGate = Math.max(MIN_GATE, this.noiseFloor * CHORD_OVER_FLOOR);
    this.gate = gate;
    this.live.loudness = loudness;

    // How loud its own sound is in the mic, measured while it plays and you've been quiet a moment. With
    // headphones that stays under the gate, so it knows it can't hear itself and filters nothing.
    const own = this.events.ownPitchClasses();
    // an average, not a peak, so the first loud moment of your own next note doesn't count as its sound
    if (own.size && !this.current && !this.pending && now - this.lastFinish > 0.4)
      this.bleed += (loudness - this.bleed) * 0.02;
    else if (!own.size) this.bleed *= 0.999;
    const hearsItself = !this.headphones && this.bleed > gate;
    this.own = hearsItself && loudness < this.bleed * BLEED_MARGIN ? own : new Set();

    const heard = loudness < gate ? null : this.identify(wave);
    if (loudness >= gate)
      log("frame", {
        t: now,
        loud: loudness,
        midi: this.reading.hz > 0 ? 69 + 12 * Math.log2(this.reading.hz / 440) : null,
        clarity: this.reading.clarity,
        strong: this.reading.strong,
        heard: heard?.key ?? null,
        own: this.own.size ? [...this.own].join(" ") : undefined,
      });
    this.live.midi = heard?.kind === "note" ? heard.midi : null;
    this.live.chord = heard?.kind === "chord" ? heard.chord : null;

    if (!heard) {
      this.pending = null;
      if (this.current && ++this.quietFrames >= RELEASE_FRAMES) this.finish(now, "quiet");
    } else {
      this.quietFrames = 0;
      const reattack =
        this.current &&
        heard.key === this.current.label &&
        loudness > this.lastLoudness * REATTACK_RATIO &&
        loudness > gate * 2;
      // the moment you start to leave the note you're on is when a slide into the next one begins
      if (this.current && heard.key !== this.current.label) this.leftAt ??= now;
      else this.leftAt = null;
      if (heard.key !== this.current?.label || reattack) this.consider(heard, now, Boolean(reattack));
      else this.pending = null;
      if (this.current) this.current.loudness = Math.max(this.current.loudness, loudness);
    }
    this.lastLoudness = loudness;
  }

  private identify(wave: Float32Array): Candidate {
    const sampleRate = Tone.getContext().sampleRate;
    const [hz, clarity] = this.detector.findPitch(wave, sampleRate);
    const { tuning, scale } = this.events.hearing();
    this.reading = { hz, clarity, strong: 0 };
    const single = clarity >= NOTE_CLARITY && hz >= LOWEST_HZ && hz <= HIGHEST_HZ;

    // chroma: every bin from 80 Hz to 2 kHz adds its energy to its pitch class
    const spectrum = this.spectrum.getValue() as Float32Array;
    const binHz = sampleRate / FFT_SIZE;
    this.chroma.fill(0);
    for (let bin = Math.ceil(80 / binHz); bin < Math.min(spectrum.length, 2000 / binHz); bin++) {
      const energy = 10 ** (spectrum[bin] / 10);
      this.chroma[pitchClass(hzToMidi(bin * binHz) - tuning)] += energy;
    }
    for (const pc of this.own) this.chroma[pc] *= 0.2;
    const peak = Math.max(...this.chroma);
    const chroma = this.chroma.map((value) => (peak ? value / peak : 0));
    const strong = chroma.filter((value) => value > 0.5).length;
    this.reading.strong = strong;

    if (clarity >= STEADY_CLARITY && hz >= LOWEST_HZ && hz <= HIGHEST_HZ && this.current?.kind === "note") {
      const exact = hzToMidi(hz);
      if (Math.abs(exact - tuning - this.current.pitches[0]) < NOTE_HOLD) this.steady.push(exact);
    }
    if (single && (strong <= 2 || clarity > 0.97)) {
      const midi = this.holdNote(hzToMidi(hz) - tuning, scale);
      // its own harmony, picked up by the mic
      if (!this.current && this.own.has(pitchClass(midi))) return null;
      return { key: noteName(midi), kind: "note", midi, chord: null };
    }
    if (strong >= 3 && clarity < CHORD_MAX_CLARITY && this.live.loudness >= this.chordGate) {
      const chord = matchChord(chroma);
      if (chord) return { key: chordName(chord), kind: "chord", midi: null, chord };
    }
    // not clear enough to be sure, but too clear to be a chord: most likely a breathy or soft single note
    if (clarity >= CHORD_MAX_CLARITY && hz >= LOWEST_HZ && hz <= HIGHEST_HZ) {
      const midi = this.holdNote(hzToMidi(hz) - tuning, scale);
      return { key: noteName(midi), kind: "note", midi, chord: null };
    }
    return null;
  }

  /** Stays on the current note through vibrato and slight drift; otherwise the nearest note (of the key, once known). */
  private holdNote(exact: number, scale: number[] | null) {
    const held = this.current?.kind === "note" ? this.current.pitches[0] : null;
    if (held !== null && Math.abs(exact - held) < NOTE_HOLD) return held;
    return scale ? hearInKey(exact, scale) : Math.round(exact);
  }

  private consider(heard: NonNullable<Candidate>, now: number, reattack: boolean) {
    if (!reattack) {
      if (this.pending?.key === heard.key) this.pendingFrames++;
      else {
        this.pending = heard;
        this.pendingFrames = 1;
        this.pendingSince = now;
      }
      const needed = heard.kind === "chord" ? CHORD_SETTLE_FRAMES : NOTE_SETTLE_FRAMES;
      if (this.pendingFrames < needed) return;
    }
    this.pending = null;
    // It takes a few frames to be sure of a new pitch, so the note began when it first appeared, not now.
    // Timing notes from now would make every note late by that wait, and the tempo it hears too slow.
    // A note you slid into began when you started leaving the last one, if that was only just before.
    const slide = this.leftAt !== null && this.pendingSince - this.leftAt < 0.15 ? this.leftAt : null;
    const start = reattack ? now : (slide ?? this.pendingSince);
    this.leftAt = null;
    if (this.current) this.finish(start, "change");
    this.steady = [];
    // a chord is drawn as its notes stacked up from its root, in the octave below middle C
    const pitches =
      heard.kind === "note"
        ? [heard.midi!]
        : heard.chord!.pcs.map((pc) => 48 + heard.chord!.root + ((pc - heard.chord!.root + 12) % 12));
    this.current = {
      id: this.nextId++,
      kind: heard.kind,
      pitches,
      exact: null,
      endedBy: null,
      chord: heard.chord,
      label: heard.key,
      start,
      end: null,
      loudness: this.live.loudness,
    };
    this.events.onStart(this.current);
  }

  private finish(now: number, endedBy: "quiet" | "change") {
    const played = this.current!;
    played.end = now;
    played.endedBy = endedBy;
    const steady = [...this.steady].sort((a, b) => a - b);
    played.exact = steady.length >= 4 ? steady[Math.floor(steady.length / 2)] : null;
    this.lastFinish = now;
    this.current = null;
    this.quietFrames = 0;
    this.events.onEnd(played);
  }

  dispose() {
    this.mic.close();
    this.mic.dispose();
    this.wave.dispose();
    this.spectrum.dispose();
  }
}
