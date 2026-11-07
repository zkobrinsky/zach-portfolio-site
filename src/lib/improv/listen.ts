import { PitchDetector } from "pitchy";
import * as Tone from "tone";
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
/** Once on a note, the pitch has to wander this far (in semitones) to count as a new one, so vibrato holds. */
const NOTE_HOLD = 0.75;
/** Its own sound only gets ignored when the mic is no louder than this many times its usual bleed. */
const BLEED_MARGIN = 2;
const LOWEST_HZ = 55;
const HIGHEST_HZ = 1500;
/** Frames a new pitch must hold before it counts, so slides and wobbles don't spray notes. */
const NOTE_SETTLE_FRAMES = 3;
const CHORD_SETTLE_FRAMES = 6;
/** Frames of quiet before a note is over. */
const RELEASE_FRAMES = 5;
/** A jump in loudness this big on the same pitch is a new attack, like re-plucking a string. */
const REATTACK_RATIO = 1.9;

export type Played = {
  id: number;
  kind: "note" | "chord";
  /** The note, or every note of the chord, placed near middle C for drawing. */
  pitches: number[];
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
};

export class Listener {
  readonly live: Live = { midi: null, chord: null, loudness: 0 };
  current: Played | null = null;
  /** With headphones the mic can't hear the buddy, so there's nothing to filter out. */
  headphones = false;

  private mic = new Tone.UserMedia();
  private wave = new Tone.Analyser("waveform", WAVE_SIZE);
  private spectrum = new Tone.Analyser({ type: "fft", size: FFT_SIZE, smoothing: 0.4 });
  private detector = PitchDetector.forFloat32Array(WAVE_SIZE);
  private chroma = new Array<number>(12).fill(0);
  private noiseFloor = MIN_GATE;
  /** How loud the buddy usually is in the mic, measured while it plays and you don't. */
  private bleed = 0;
  /** Its own pitch classes this frame, or empty when it can't be heard (headphones, or you're much louder). */
  private own = new Set<number>();
  private lastLoudness = 0;
  private pending: Candidate = null;
  private pendingFrames = 0;
  private quietFrames = 0;
  private nextId = 1;

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
    // the floor sinks straight to quiet moments and creeps up slowly, so it learns the room without chasing the music
    this.noiseFloor = loudness < this.noiseFloor ? loudness : this.noiseFloor + (loudness - this.noiseFloor) * 0.0008;
    const gate = Math.max(MIN_GATE, this.noiseFloor * 3);
    this.live.loudness = loudness;

    const own = this.headphones ? new Set<number>() : this.events.ownPitchClasses();
    if (own.size && !this.current) this.bleed = Math.max(loudness, this.bleed * 0.995);
    else if (!own.size) this.bleed *= 0.999;
    this.own = loudness < this.bleed * BLEED_MARGIN ? own : new Set();

    const heard = loudness < gate ? null : this.identify(wave);
    this.live.midi = heard?.kind === "note" ? heard.midi : null;
    this.live.chord = heard?.kind === "chord" ? heard.chord : null;

    if (!heard) {
      this.pending = null;
      if (this.current && ++this.quietFrames >= RELEASE_FRAMES) this.finish(now);
    } else {
      this.quietFrames = 0;
      const reattack = this.current && heard.key === this.current.label && loudness > this.lastLoudness * REATTACK_RATIO && loudness > gate * 2;
      if (heard.key !== this.current?.label || reattack) this.consider(heard, now, Boolean(reattack));
      else this.pending = null;
      if (this.current) this.current.loudness = Math.max(this.current.loudness, loudness);
    }
    this.lastLoudness = loudness;
  }

  private identify(wave: Float32Array): Candidate {
    const sampleRate = Tone.getContext().sampleRate;
    const [hz, clarity] = this.detector.findPitch(wave, sampleRate);
    const single = clarity >= NOTE_CLARITY && hz >= LOWEST_HZ && hz <= HIGHEST_HZ;

    // chroma: every bin from 80 Hz to 2 kHz adds its energy to its pitch class
    const spectrum = this.spectrum.getValue() as Float32Array;
    const binHz = sampleRate / FFT_SIZE;
    this.chroma.fill(0);
    for (let bin = Math.ceil(80 / binHz); bin < Math.min(spectrum.length, 2000 / binHz); bin++) {
      const energy = 10 ** (spectrum[bin] / 10);
      this.chroma[pitchClass(hzToMidi(bin * binHz))] += energy;
    }
    for (const pc of this.own) this.chroma[pc] *= 0.2;
    const peak = Math.max(...this.chroma);
    const chroma = this.chroma.map((value) => (peak ? value / peak : 0));
    const strong = chroma.filter((value) => value > 0.5).length;

    if (single && (strong <= 2 || clarity > 0.97)) {
      const midi = this.holdNote(hzToMidi(hz));
      // its own harmony, picked up by the mic
      if (!this.current && this.own.has(pitchClass(midi))) return null;
      return { key: noteName(midi), kind: "note", midi, chord: null };
    }
    if (strong >= 3) {
      const chord = matchChord(chroma);
      if (chord) return { key: chordName(chord), kind: "chord", midi: null, chord };
    }
    if (single) {
      const midi = this.holdNote(hzToMidi(hz));
      return { key: noteName(midi), kind: "note", midi, chord: null };
    }
    return null;
  }

  /** Stays on the current note through vibrato and slight drift; otherwise the nearest note. */
  private holdNote(exact: number) {
    const held = this.current?.kind === "note" ? this.current.pitches[0] : null;
    return held !== null && Math.abs(exact - held) < NOTE_HOLD ? held : Math.round(exact);
  }

  private consider(heard: NonNullable<Candidate>, now: number, reattack: boolean) {
    if (!reattack) {
      if (this.pending?.key === heard.key) this.pendingFrames++;
      else {
        this.pending = heard;
        this.pendingFrames = 1;
      }
      const needed = heard.kind === "chord" ? CHORD_SETTLE_FRAMES : NOTE_SETTLE_FRAMES;
      if (this.pendingFrames < needed) return;
    }
    this.pending = null;
    if (this.current) this.finish(now);
    // a chord is drawn as its notes stacked up from its root, in the octave below middle C
    const pitches =
      heard.kind === "note" ? [heard.midi!] : heard.chord!.pcs.map((pc) => 48 + heard.chord!.root + ((pc - heard.chord!.root + 12) % 12));
    this.current = {
      id: this.nextId++,
      kind: heard.kind,
      pitches,
      chord: heard.chord,
      label: heard.key,
      start: now,
      end: null,
      loudness: this.live.loudness,
    };
    this.events.onStart(this.current);
  }

  private finish(now: number) {
    const played = this.current!;
    played.end = now;
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
