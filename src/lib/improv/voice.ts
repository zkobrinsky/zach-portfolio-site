import * as Tone from "tone";
import { midiToHz, pitchClass } from "./theory";

/*
  The buddy's sound: soft, glassy FM pads with slow swells, through a slow chorus, an echo that locks to the
  beat, and a long reverb, so it floats like the rest of the site. Notes go on a short queue rather than
  straight to Tone, so planned notes can still be dropped when the player comes back in.
*/
export type Role = "harmony" | "answer" | "lead";

export type BuddyNote = {
  midi: number;
  start: number;
  /** Null while held: harmony lasts as long as the player's note. */
  end: number | null;
  role: Role;
  velocity: number;
  /** Not played yet: still on the queue. */
  planned: boolean;
};

/** How far ahead the queue hands notes to Tone, in seconds. */
const LOOKAHEAD = 0.08;

export class Voice {
  readonly notes: BuddyNote[] = [];
  private synth: Tone.PolySynth<Tone.FMSynth>;
  private delay = new Tone.FeedbackDelay({ delayTime: 0.375, feedback: 0.32, wet: 0.2 });
  private reverb = new Tone.Reverb({ decay: 9, preDelay: 0.04, wet: 0.55 });
  private chorus = new Tone.Chorus({ frequency: 0.25, delayTime: 4, depth: 0.6, wet: 0.45 }).start();
  private output = new Tone.Volume(-6).toDestination();

  constructor() {
    this.synth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2,
      modulationIndex: 1.4,
      oscillator: { type: "sine" },
      modulation: { type: "triangle" },
      envelope: { attack: 0.09, decay: 0.8, sustain: 0.55, release: 3.2 },
      modulationEnvelope: { attack: 0.4, decay: 0.6, sustain: 0.3, release: 2 },
      volume: -10,
    });
    this.synth.maxPolyphony = 16;
    this.synth.chain(this.chorus, this.delay, this.reverb, this.output);
  }

  set muted(value: boolean) {
    this.output.mute = value;
  }

  /** The echo lands on the off-beat, a dotted eighth after each note. */
  syncEcho(beatSeconds: number) {
    this.delay.delayTime.rampTo(beatSeconds * 0.75, 0.5);
  }

  /** Starts a note that rings until `release`. */
  hold(midi: number, time: number, role: Role, velocity = 0.5) {
    const note: BuddyNote = { midi, start: time, end: null, role, velocity, planned: false };
    this.synth.triggerAttack(midiToHz(midi), time, velocity);
    this.notes.push(note);
    return note;
  }

  release(note: BuddyNote, time: number) {
    if (note.end !== null) return;
    note.end = time;
    this.synth.triggerRelease(midiToHz(note.midi), time);
  }

  /** Queues a note of fixed length. */
  plan(midi: number, start: number, duration: number, role: Role, velocity = 0.45) {
    const note: BuddyNote = { midi, start, end: start + duration, role, velocity, planned: true };
    this.notes.push(note);
    return note;
  }

  /** Drops queued notes of a role, and lets any of them that are sounding fade out now. */
  cancel(role: Role, now: number) {
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const note = this.notes[i];
      if (note.role !== role) continue;
      if (note.planned) this.notes.splice(i, 1);
      else if (note.end === null || note.end > now) {
        note.end = now;
        this.synth.triggerRelease(midiToHz(note.midi), now);
      }
    }
  }

  hasPlanned(role?: Role) {
    return this.notes.some((note) => note.planned && (!role || note.role === role));
  }

  isSounding(role: Role, now: number) {
    return this.notes.some((note) => note.role === role && !note.planned && note.start <= now && (note.end === null || note.end > now));
  }

  /** Pitch classes ringing now, including a moment of tail, so the listener can ignore them. */
  pitchClassesAt(now: number) {
    const pcs = new Set<number>();
    for (const note of this.notes) if (!note.planned && note.start <= now && (note.end === null || note.end + 0.6 > now)) pcs.add(pitchClass(note.midi));
    return pcs;
  }

  /** Call once a frame: hands due notes to Tone and forgets ones long gone. */
  update(now: number) {
    for (const note of this.notes) {
      if (!note.planned || note.start > now + LOOKAHEAD) continue;
      note.planned = false;
      const start = Math.max(note.start, now);
      this.synth.triggerAttackRelease(midiToHz(note.midi), Math.max(0.05, note.end! - start), start, note.velocity);
    }
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const end = this.notes[i].end;
      if (end !== null && now - end > 20) this.notes.splice(i, 1);
    }
  }

  dispose() {
    this.synth.releaseAll();
    for (const node of [this.synth, this.chorus, this.delay, this.reverb, this.output]) node.dispose();
  }
}
