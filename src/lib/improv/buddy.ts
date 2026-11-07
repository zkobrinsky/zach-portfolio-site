import * as Tone from "tone";
import { BeatTracker } from "./beat";
import { Listener, type Played } from "./listen";
import { KeyTracker } from "./key";
import { composeAnswer } from "./phrasing";
import { chordName, type Key, keyName, pitchClass, scaleOf } from "./theory";
import { type BuddyNote, Voice } from "./voice";

/*
  The friend you're jamming with. It moves between three things, like a musician would:

    harmonize  while you hold a note, it comes in just after you on a third or sixth in your key and holds it
               with you. Over a chord it floats a pad, or once it has the beat, a slow line of chord tones.
    answer     when you leave a gap, it fills it in time with a short reply: your rhythm, with your melody's
               shape turned upside down, ending somewhere restful. It stops the moment you play again.
    lead       if you go quiet for a while, it offers a little idea built from something you played earlier.
*/
/** How long after your note starts it joins in. A backing singer's delay, which also hides detection time. */
const HARMONY_WAIT = 0.12;
/** On fast runs it waits longer, so only the notes you lean on get harmony. */
const HARMONY_WAIT_FAST = 0.3;
const FAST_RUN_GAP = 0.2;
const MIN_PHRASE_NOTES = 2;
/** Quiet this long (seconds, before the beat is known) means you've left a gap to answer. */
const ANSWER_GAP = 0.35;
/** Once the beat is known: half a beat of quiet, but never less than this. */
const MIN_ANSWER_GAP = 0.22;
/** Quiet this many beats and it might lead, at most once every LEAD_EVERY beats. */
const LEAD_AFTER_BEATS = 6;
const LEAD_EVERY_BEATS = 16;
/** After this much quiet it stops offering ideas and just listens. */
const GIVE_UP_SECONDS = 15;
const LOW = 50;
const HIGH = 86;
/** Harmony intervals from your note, in semitones: thirds and sixths below, thirds above. */
const HARMONY_INTERVALS = [-3, -4, -8, -9, 3, 4];

const within = (midi: number) => {
  let note = midi;
  while (note < LOW) note += 12;
  while (note > HIGH) note -= 12;
  return note;
};
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

export class Buddy {
  readonly beat = new BeatTracker();
  readonly voice = new Voice();
  readonly listener: Listener;
  /** Everything you've played, for drawing. */
  readonly played: Played[] = [];
  readonly keys = new KeyTracker();
  status = "listening…";
  /** A short-lived message, like the "got it" when the beat locks. */
  flash: { text: string; at: number } | null = null;

  private phrase: Played[] = [];
  private motif: Played[] = [];
  private answered = true;
  private harmony: BuddyNote | null = null;
  private harmonyFor: number | null = null;
  private lastHarmony: number | null = null;
  private chordLine: number | null = null;
  private lastStart = -Infinity;
  private lastEnd = -Infinity;
  private ledAt = -Infinity;
  private fastRun = false;

  constructor() {
    this.listener = new Listener({
      onStart: (played) => this.heardStart(played),
      onEnd: (played) => this.heardEnd(played),
      ownPitchClasses: () => this.voice.pitchClassesAt(Tone.immediate()),
    });
  }

  start() {
    return this.listener.open();
  }

  private heardStart(played: Played) {
    const now = played.start;
    this.played.push(played);
    if (this.played.length > 400) this.played.shift();
    this.fastRun = now - this.lastStart < FAST_RUN_GAP;
    this.lastStart = now;

    const wasLocked = this.beat.locked;
    this.beat.addOnset(now);
    if (this.beat.period) {
      this.voice.syncEcho(this.beat.period);
      if (!wasLocked) this.flash = { text: `✓ got it · ${this.beat.bpm} bpm`, at: now };
    }

    // you're playing again: it gets out of the way
    this.voice.cancel("answer", now);
    this.voice.cancel("lead", now);

    // a long silence starts a new phrase
    if (now - this.lastEnd > Math.max(2, (this.beat.period ?? 0.6) * 4)) this.phrase = [];
    this.phrase.push(played);
    this.answered = false;
  }

  private heardEnd(played: Played) {
    this.lastEnd = played.end!;
    if (this.harmony && this.harmonyFor === played.id) this.letGoOfHarmony(played.end!);
  }

  private letGoOfHarmony(now: number) {
    if (this.harmony) this.voice.release(this.harmony, now);
    this.harmony = null;
    this.harmonyFor = null;
  }

  /** Call once a frame. */
  update(now: number) {
    this.listener.update(now);
    this.voice.update(now);
    const current = this.listener.current;
    this.keys.update(now, current && { pitches: current.pitches, chord: current.kind === "chord" });

    if (this.harmonyFor !== null && current?.id !== this.harmonyFor) this.letGoOfHarmony(now);

    if (current && this.harmonyFor !== current.id) {
      const wait = this.fastRun ? HARMONY_WAIT_FAST : HARMONY_WAIT;
      if (now - current.start >= wait) {
        if (current.kind === "note") this.harmonizeNote(current, now);
        else if (!this.beat.locked) this.padUnderChord(current, now);
      }
    }
    if (current?.kind === "chord" && this.beat.period && !this.voice.hasPlanned("lead")) this.lineOverChord(current, now);

    if (!current && !this.answered && this.phrase.length >= MIN_PHRASE_NOTES) {
      const gap = this.beat.period ? Math.max(MIN_ANSWER_GAP, this.beat.period / 2) : ANSWER_GAP;
      if (now - this.lastEnd >= gap) {
        const last = this.phrase[this.phrase.length - 1];
        this.keys.phraseEnded(last.pitches[0]);
        this.answer(now);
        this.answered = true;
        this.motif = this.phrase.slice(-6);
      }
    }

    const period = this.beat.period;
    const quiet = now - this.lastEnd;
    if (
      !current &&
      period &&
      this.motif.length >= MIN_PHRASE_NOTES &&
      quiet > period * LEAD_AFTER_BEATS &&
      quiet < GIVE_UP_SECONDS &&
      now - this.ledAt > period * LEAD_EVERY_BEATS &&
      !this.voice.hasPlanned()
    ) {
      this.lead(now);
      this.ledAt = now;
    }

    this.status = this.describe(now, current);
  }

  /**
   * A third or sixth measured from the note you actually played, so it's always consonant with you. The key
   * only picks between major and minor versions. Until it's sure of the key, it plays a fifth or fourth below,
   * which fit almost anything.
   */
  private harmonizeNote(played: Played, now: number) {
    const midi = played.pitches[0];
    const key = this.key;
    const scale = key ? scaleOf(key) : null;
    const options = scale
      ? HARMONY_INTERVALS.map((interval) => midi + interval).filter((note) => scale.includes(pitchClass(note)))
      : [midi - 7, midi - 5];
    if (!options.length) options.push(midi - 7);
    const previous = this.lastHarmony ?? midi - 4;
    // favor a third below; otherwise the smallest move from its last harmony note, so its line moves smoothly
    const choice = options.reduce((best, option) => {
      const moved = within(option);
      const cost = Math.abs(moved - previous) + (option - midi >= -4 && option < midi ? -2 : 0) + (moved === midi ? 50 : 0);
      return cost < best.cost ? { midi: moved, cost } : best;
    }, { midi: within(options[0]), cost: Infinity }).midi;
    this.harmony = this.voice.hold(choice, now + 0.01, "harmony", 0.3 + Math.min(0.3, played.loudness * 3));
    this.harmonyFor = played.id;
    this.lastHarmony = choice;
  }

  /** Before it has the beat: one soft note floating above your chord, its third or its ninth. */
  private padUnderChord(played: Played, now: number) {
    const root = played.chord!.root;
    const third = played.chord!.pcs[1];
    const top = pick([third, (root + 2) % 12, played.chord!.pcs[2]]);
    this.harmony = this.voice.hold(within(72 + top), now + 0.01, "harmony", 0.28);
    this.harmonyFor = played.id;
  }

  /** With the beat: a slow line of chord tones and ninths over your chord, one note a beat, mostly stepwise. */
  private lineOverChord(played: Played, now: number) {
    const period = this.beat.period!;
    const chord = played.chord!;
    const colors = [...chord.pcs, (chord.root + 2) % 12];
    const from = this.chordLine ?? 74;
    const candidates: number[] = [];
    for (let midi = from - 5; midi <= from + 5; midi++) if (midi !== from && colors.includes(pitchClass(midi))) candidates.push(midi);
    const next = within(pick(candidates.length ? candidates : [from]));
    this.chordLine = next;
    this.voice.plan(next, this.beat.next(now + 0.03), period * 0.9, "lead", 0.3);
  }

  /** Answers your phrase: see phrasing.ts. It comes in on the next beat if that's close, else the next eighth. */
  private answer(now: number) {
    const period = this.beat.period;
    let start = now + 0.05;
    if (period) {
      const beat = this.beat.next(now + 0.03);
      start = beat - now < period * 0.6 ? beat : this.beat.next(now + 0.03, 2);
    }
    this.play(this.phrase, start, "answer");
  }

  /** An idea of its own, phrased the same way from something you played earlier, starting on the next bar. */
  private lead(now: number) {
    const period = this.beat.period!;
    const bar = this.beat.anchor + Math.ceil(this.beat.position(now + 0.05) / 4) * 4 * period;
    this.play(this.motif, bar, "lead");
  }

  private play(phrase: Played[], start: number, role: "answer" | "lead") {
    const call = phrase.map((played) => ({ pitch: Math.max(...played.pitches), start: played.start, end: played.end ?? played.start + 0.3 }));
    for (const note of composeAnswer(call, this.key, this.beat.period)) {
      this.voice.plan(within(note.midi), start + note.offset, note.duration, role, note.accent ? 0.5 : 0.4);
    }
  }

  private describe(now: number, current: Played | null) {
    if (this.voice.isSounding("answer", now) || this.voice.hasPlanned("answer")) return "↳ answering";
    if (current?.kind === "chord") return `${chordName(current.chord!)} · floating over it`;
    if (this.harmony) return "harmonizing";
    if (this.voice.isSounding("lead", now) || this.voice.hasPlanned("lead")) return "↳ trying an idea";
    if (!this.played.length) return "play something…";
    if (!this.beat.locked) return "listening…";
    return now - this.lastEnd > GIVE_UP_SECONDS ? "listening…" : "your turn";
  }

  /** The key it's sure enough of to play in. */
  get key(): Key | null {
    return this.keys.trusted;
  }

  /** Its current guess, with a question mark until it's sure. */
  get keyLabel() {
    const guess = this.keys.key;
    if (!guess) return null;
    return `${keyName(guess)}${this.keys.trusted ? "" : "?"}`;
  }

  dispose() {
    this.listener.dispose();
    this.voice.dispose();
  }
}
