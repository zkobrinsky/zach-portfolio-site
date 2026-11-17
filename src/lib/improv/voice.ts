import * as Tone from "tone";
import { midiToHz, pitchClass } from "./theory";

/*
  The buddy's sound: soft, glassy FM pads through a gentle chorus, a light echo that locks to the beat, and a
  short reverb: clear enough that the rhythm comes through. Notes go on a short queue rather than
  straight to Tone, so planned notes can still be dropped when the player comes back in.
*/
export type Role = "harmony" | "answer" | "lead" | "groove";

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
  private delay = new Tone.FeedbackDelay({ delayTime: 0.375, feedback: 0.2, wet: 0.08 });
  private reverb = new Tone.Reverb({ decay: 3, preDelay: 0.02, wet: 0.2 });
  private chorus = new Tone.Chorus({ frequency: 0.25, delayTime: 4, depth: 0.5, wet: 0.25 }).start();
  private output = new Tone.Volume(0).toDestination();

  constructor() {
    this.synth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2,
      modulationIndex: 1.4,
      oscillator: { type: "sine" },
      modulation: { type: "triangle" },
      envelope: { attack: 0.06, decay: 0.8, sustain: 0.55, release: 1 },
      modulationEnvelope: { attack: 0.3, decay: 0.6, sustain: 0.3, release: 0.8 },
      volume: -2,
    });
    this.synth.maxPolyphony = 16;
    this.synth.chain(this.chorus, this.delay, this.reverb, this.output);
  }

  set muted(value: boolean) {
    this.output.mute = value;
  }

  /** Plays in your tuning, not A440, so it sits with you. In semitones. */
  tuneTo(semitones: number) {
    const cents = Math.round(semitones * 100);
    if (Math.abs(cents - this.cents) < 2) return;
    this.cents = cents;
    this.synth.set({ detune: cents });
  }
  private cents = 0;

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
    let dropped = 0;
    let cut = 0;
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const note = this.notes[i];
      if (note.role !== role) continue;
      if (note.planned) {
        this.notes.splice(i, 1);
        dropped++;
      } else if (note.end === null || note.end > now) {
        note.end = now;
        this.synth.triggerRelease(midiToHz(note.midi), now);
        cut++;
      }
    }
    return { dropped, cut };
  }

  /** Drops queued notes of a role that haven't started, leaving any that are sounding to finish. */
  drop(role: Role) {
    for (let i = this.notes.length - 1; i >= 0; i--)
      if (this.notes[i].planned && this.notes[i].role === role) this.notes.splice(i, 1);
  }

  hasPlanned(role?: Role) {
    return this.notes.some((note) => note.planned && (!role || note.role === role));
  }

  isSounding(role: Role, now: number) {
    return this.notes.some(
      (note) => note.role === role && !note.planned && note.start <= now && (note.end === null || note.end > now),
    );
  }

  /** Pitch classes ringing now, including a moment of tail, so the listener can ignore them. */
  pitchClassesAt(now: number) {
    const pcs = new Set<number>();
    for (const note of this.notes)
      if (!note.planned && note.start <= now && (note.end === null || note.end + 0.6 > now))
        pcs.add(pitchClass(note.midi));
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
