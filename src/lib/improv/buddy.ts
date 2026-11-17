import * as Tone from "tone";
import { BeatTracker } from "./beat";
import { Listener, type Played } from "./listen";
import { KeyTracker } from "./key";
import { log } from "./debug";
import { composeAnswer, type Grid } from "./phrasing";
import { chordName, keyName, NOTE_NAMES, pitchClass } from "./theory";
import { type BuddyNote, Voice } from "./voice";

/*
  The friend you're playing with. Once it's sure of your key and tempo, it moves between these, like an
  accompanist does depending on how much room you leave:

    groove     underneath everything while you're playing: home on the bar's first beat and its fifth on the
               third, low and soft, so there's always a pulse to sit in.
    harmonize  while you hold a note, it comes in just after you on a third or sixth in your key and holds it
               with you. Over a chord it floats a pad, or once it has the beat, a slow line of chord tones.
    answer     when you leave room between phrases, it answers in it: from the next beat, or the next bar if
               you leave a long rest, sized to finish before you usually come back in. If you barely pause,
               it doesn't try to squeeze an answer in; the groove and harmony carry it.
    lead       if you go quiet for a while, it offers a little idea built from something you played earlier.

  Bars start where your phrases do: the downbeat is the beat your latest phrase began on.
*/
/** How long after your note starts it joins in. A backing singer's delay, which also hides detection time. */
const HARMONY_WAIT = 0.12;
/** On fast runs it waits longer, so only the notes you lean on get harmony. */
const HARMONY_WAIT_FAST = 0.3;
const FAST_RUN_GAP = 0.2;
const MIN_PHRASE_NOTES = 2;
/**
 * Shorter than this (seconds) isn't a note you meant: it's a singer's scoop or slide between notes, or a
 * glitch. It doesn't count toward the beat or the phrase it answers.
 */
const MIN_NOTE = 0.1;
/** A repeat of the note before that's shorter than this and this soon after it is a scoop, not a note. */
const SCOOP = 0.2;
/** Only notes held this long (seconds) tell it about the key: shorter ones are often passing or sliding. */
const KEY_NOTE = 0.2;
/** Before it has found the beat, it guesses one from your phrase's pace, folded into this range (seconds). */
const GUESSED_BEAT_MIN = 0.4;
const GUESSED_BEAT_MAX = 0.9;
/**
 * Your phrase is over when nothing new has started for this many times your usual gap between notes. It
 * counts from the start of your last note, not the end, so it doesn't wait out a guitar's whole decay, and
 * the short breaths between notes inside a phrase don't fool it.
 */
const PHRASE_END_GAPS = 2;
/** That wait is kept between one beat (and at least this) and two beats (and at least the upper bound). */
const PHRASE_END_MIN = 0.6;
const PHRASE_END_MAX = 1.4;
/** How long you usually rest between phrases (beats), before it has heard you do it. */
const USUAL_REST = 4;
/** It aims to finish its answer this many beats before you'd usually come back in. */
const ANSWER_CLEARANCE = 0.5;
/** An answer shorter than this (beats) isn't worth playing. */
const MIN_ANSWER_BEATS = 1;
/** With at least this much rest (beats), it waits for the next bar to answer. */
const BAR_REST = 4;
/** Bars are 4 beats, or 3 when your phrases come round every 3, 6 or 9 beats. */
const COMMON_BAR = 4;
/** The groove plays while you've started a note in the last this-many bars. */
const GROOVE_BARS = 2;
/** The groove's register: home in the octave starting here (MIDI). */
const GROOVE_LOW = 45;
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
const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];

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
  /** When its latest answer, and its latest idea, start sounding. */
  private answerAt = -Infinity;
  private leadAt = -Infinity;
  private fastRun = false;
  /** When your last phrase ended, how long you rested between recent phrases (beats), and the downbeat. */
  private phraseEndedAt = -Infinity;
  private rests: number[] = [];
  private downbeat: number | null = null;
  /** Beats between the starts of your recent phrases, for the meter. */
  private cycles: number[] = [];
  private lastPhraseStart = -Infinity;
  /** Debug: the phrase it last reported as left unanswered, so it says so once. */
  private reportedSkip: Played | null = null;

  constructor() {
    this.listener = new Listener({
      onStart: (played) => this.heardStart(played),
      onEnd: (played) => this.heardEnd(played),
      ownPitchClasses: () => this.voice.pitchClassesAt(Tone.immediate()),
      hearing: () => ({ tuning: this.keys.tuning, scale: this.keys.scale }),
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

    // A new phrase starts once your last one was over, or after a long silence. If you came back in before
    // its answer began, you hadn't finished, so it's still the same phrase.
    const answerBegan = this.answered && now >= this.answerAt;
    const longSilence = now - this.lastEnd > Math.max(2, (this.beat.period ?? 0.6) * 4);
    if (answerBegan || longSilence) {
      const period = this.beat.period;
      if (period && this.answered && now - this.phraseEndedAt < period * 16) {
        this.rests.push((now - this.phraseEndedAt) / period);
        if (this.rests.length > 6) this.rests.shift();
      }
      this.phrase = [];
      if (period) {
        // your phrases start bars: the downbeat moves to the beat nearest where this one began
        this.downbeat = this.beat.anchor + Math.round((now - this.beat.anchor) / period) * period;
        const cycle = Math.round((now - this.lastPhraseStart) / period);
        if (cycle >= 2 && cycle <= 16) {
          this.cycles.push(cycle);
          if (this.cycles.length > 4) this.cycles.shift();
        }
        // the groove picks up from the new downbeat instead of finishing a bar counted from the old one
        this.voice.drop("groove");
      }
      this.lastPhraseStart = now;
    }

    // You're playing again. Once its answer or idea has started, it plays on with you: it's a duet. One that
    // hasn't started yet is dropped, since you weren't finished.
    const none = { dropped: 0, cut: 0 };
    const answer = now < this.answerAt ? this.voice.cancel("answer", now) : none;
    const lead = now < this.leadAt ? this.voice.cancel("lead", now) : none;
    log("start", {
      t: now,
      id: played.id,
      label: played.label,
      loud: played.loudness,
      gate: this.listener.gate,
      tuning: this.keys.tuning,
      sinceLastStart: now - (this.played[this.played.length - 2]?.start ?? -Infinity),
      newPhrase: answerBegan ? "after answer" : longSilence ? "after silence" : false,
      phraseLen: this.phrase.length + 1,
      cutAnswer: answer.dropped || answer.cut ? answer : undefined,
      cutLead: lead.dropped || lead.cut ? lead : undefined,
      bpm: this.beat.bpm,
      key: this.keyLabel,
    });
    this.phrase.push(played);
    this.answered = false;
  }

  private heardEnd(played: Played) {
    this.lastEnd = played.end!;
    const held = played.end! - played.start;
    if (played.kind === "note" && played.exact !== null && held >= KEY_NOTE)
      this.keys.heard({ pitch: played.exact, seconds: held });
    // A short note on the same pitch as the one before that runs straight into a different note is the start
    // of a scoop, still sounding like the old note for a moment. It isn't a note. A repeated note you sing
    // on purpose ends in a breath, not a slide, so it still counts.
    const before = this.phrase[this.phrase.indexOf(played) - 1];
    const scoop = Boolean(
      before &&
      before.label === played.label &&
      held < SCOOP &&
      played.start - before.end! < SCOOP &&
      played.endedBy === "change",
    );
    log("end", {
      t: played.end,
      id: played.id,
      label: played.label,
      held,
      glitch: held < MIN_NOTE || scoop || undefined,
    });
    if (held < MIN_NOTE || scoop) {
      // not a real note: forget it, and time the phrase from the last real one
      this.phrase = this.phrase.filter((note) => note !== played);
      this.lastStart = this.phrase[this.phrase.length - 1]?.start ?? this.lastStart;
    } else {
      // its start goes to the beat finder now that it's known to be real
      const wasLocked = this.beat.locked;
      this.beat.addOnset(played.start);
      if (this.beat.period) {
        this.voice.syncEcho(this.beat.period);
        if (!wasLocked) this.flash = { text: `✓ got it · ${this.beat.bpm} bpm`, at: played.end! };
      }
    }
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
    this.voice.tuneTo(this.keys.tuning);
    this.voice.update(now);
    const current = this.listener.current;
    const ready = this.ready;

    if (this.harmonyFor !== null && current?.id !== this.harmonyFor) this.letGoOfHarmony(now);

    if (ready && current && this.harmonyFor !== current.id) {
      const wait = this.fastRun ? HARMONY_WAIT_FAST : HARMONY_WAIT;
      if (now - current.start >= wait) {
        if (current.kind === "note") this.harmonizeNote(current, now);
        else if (!this.beat.locked) this.padUnderChord(current, now);
      }
    }
    if (ready && current?.kind === "chord" && this.beat.period && !this.voice.hasPlanned("lead"))
      this.lineOverChord(current, now);

    if (!this.answered && this.phrase.length >= MIN_PHRASE_NOTES && current?.kind !== "chord" && this.phraseOver(now)) {
      this.phraseEndedAt = this.lastEnd;
      const room = ready ? this.answerRoom(now) : null;
      if (!ready) {
        // not sure of your key and tempo yet: it keeps listening rather than guess
        this.answered = true;
        log("not ready", { t: now, key: this.keyLabel, confidence: this.keys.key?.confidence, bpm: this.beat.bpm });
      } else if (!room) {
        // you barely pause between phrases: no room to answer, so the groove and harmony carry it
        this.answered = true;
        this.answerAt = now;
        log("no room", { t: now, usualRest: this.usualRest });
      } else {
        // your last note may still be ringing: its harmony bows out for the answer
        if (current) {
          this.letGoOfHarmony(now);
          this.harmonyFor = current.id;
        }
        this.answer(now, room);
        log("answer", {
          t: now,
          ringing: current?.label,
          sinceLastStart: now - this.lastStart,
          sinceLastEnd: current ? undefined : now - this.lastEnd,
          call: this.phrase.map((played) => played.label).join(" "),
          startsIn: this.answerAt - now,
          grid: this.beat.period ? `${this.beat.bpm} bpm` : `guessed ${Math.round(60 / (this.grid?.period ?? 1))} bpm`,
          beatFit: this.beat.fit,
          notes: this.voice.notes
            .filter((note) => note.planned && note.role === "answer")
            .map((note) => note.midi)
            .join(" "),
          key: this.keyLabel,
          keyConfidence: this.keys.key?.confidence,
          palette: this.keys.palette?.pcs.join(" "),
        });
        this.answered = true;
        this.motif = this.phrase.slice(-6);
      }
    }

    const last = this.phrase[this.phrase.length - 1];
    if (!current && !this.answered && last && last !== this.reportedSkip && now - this.lastEnd > 1) {
      this.reportedSkip = last;
      log("unanswered", { t: now, phraseLen: this.phrase.length, call: this.phrase.map((p) => p.label).join(" ") });
    }

    if (ready) this.groove(now);
    else this.voice.cancel("groove", now);

    const period = this.beat.period;
    const quiet = now - this.lastEnd;
    if (
      ready &&
      !current &&
      period &&
      this.motif.length >= MIN_PHRASE_NOTES &&
      quiet > period * LEAD_AFTER_BEATS &&
      quiet < GIVE_UP_SECONDS &&
      now - this.ledAt > period * LEAD_EVERY_BEATS &&
      !this.voice.hasPlanned("answer") &&
      !this.voice.hasPlanned("lead")
    ) {
      this.lead(now);
      this.ledAt = now;
      log("lead", { t: now, motif: this.motif.map((p) => p.label).join(" ") });
    }

    this.status = this.describe(now, current);
  }

  /** Nothing new has started for a while, by the pace of your phrase. */
  /** Your usual time from one note to the next in this phrase: its pulse, beat or no beat. */
  private pace() {
    const gaps = this.phrase
      .slice(1)
      .map((played, i) => played.start - this.phrase[i].start)
      .sort((a, b) => a - b);
    return gaps[Math.floor(gaps.length / 2)] ?? PHRASE_END_MIN;
  }

  /**
   * The beat to play to: the one it found, or until then a guess from your phrase, taking your usual gap
   * between notes as some number of eighths or sixteenths of a beat and starting from your first note.
   */
  private get grid(): Grid | null {
    if (this.beat.period) return { period: this.beat.period, anchor: this.beat.anchor };
    if (this.phrase.length < 2) return null;
    let period = this.pace();
    while (period < GUESSED_BEAT_MIN) period *= 2;
    while (period > GUESSED_BEAT_MAX) period /= 2;
    return { period, anchor: this.phrase[0].start };
  }

  private phraseOver(now: number) {
    const usual = this.pace();
    const beat = this.beat.period ?? PHRASE_END_MIN;
    const wait = Math.min(Math.max(PHRASE_END_MAX, beat * 2), Math.max(PHRASE_END_MIN, beat, usual * PHRASE_END_GAPS));
    return now - this.lastStart >= wait;
  }

  /**
   * A third or sixth measured from the note you actually played, so it's always consonant with you. Which
   * one comes from the notes you've been playing. Until it has heard enough, it plays a fifth or fourth
   * below, which fit almost anything.
   */
  private harmonizeNote(played: Played, now: number) {
    const midi = played.pitches[0];
    const scale = this.keys.palette?.pcs;
    const options = scale
      ? HARMONY_INTERVALS.map((interval) => midi + interval).filter((note) => scale.includes(pitchClass(note)))
      : [midi - 7, midi - 5];
    if (!options.length) options.push(midi - 7);
    const previous = this.lastHarmony ?? midi - 4;
    // favor a third below; otherwise the smallest move from its last harmony note, so its line moves smoothly
    const choice = options.reduce(
      (best, option) => {
        const moved = within(option);
        const cost =
          Math.abs(moved - previous) + (option - midi >= -4 && option < midi ? -2 : 0) + (moved === midi ? 50 : 0);
        return cost < best.cost ? { midi: moved, cost } : best;
      },
      { midi: within(options[0]), cost: Infinity },
    ).midi;
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
    for (let midi = from - 5; midi <= from + 5; midi++)
      if (midi !== from && colors.includes(pitchClass(midi))) candidates.push(midi);
    const next = within(pick(candidates.length ? candidates : [from]));
    this.chordLine = next;
    this.voice.plan(next, this.beat.next(now + 0.03), period * 0.9, "lead", 0.3);
  }

  /** Beats in a bar: 3 when your phrases keep coming round on a multiple of 3 that isn't one of 4. */
  private get beatsPerBar() {
    if (!this.cycles.length) return COMMON_BAR;
    const sorted = [...this.cycles].sort((a, b) => a - b);
    const cycle = sorted[Math.floor(sorted.length / 2)];
    return cycle % 3 === 0 && cycle % 4 !== 0 ? 3 : COMMON_BAR;
  }

  /** How many beats you usually rest between phrases. */
  private get usualRest() {
    if (!this.rests.length) return USUAL_REST;
    const sorted = [...this.rests].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  /**
   * Where its answer can go: from the next beat (or the next bar, after a long rest) until a little before
   * you'd usually come back in. Null when that's too short to say anything.
   */
  private answerRoom(now: number) {
    const period = this.beat.period!;
    const back = this.phraseEndedAt + this.usualRest * period;
    let from = this.beat.next(now + 0.04);
    if (this.usualRest >= BAR_REST && this.downbeat !== null) {
      const bar = period * this.beatsPerBar;
      const nextBar = this.downbeat + Math.ceil((now + 0.04 - this.downbeat) / bar) * bar;
      if (back - nextBar >= (MIN_ANSWER_BEATS + ANSWER_CLEARANCE) * period) from = nextBar;
    }
    const until = back - ANSWER_CLEARANCE * period;
    return until - from >= MIN_ANSWER_BEATS * period ? { from, until } : null;
  }

  /** Answers your phrase (see phrasing.ts) in the room you've left. */
  private answer(now: number, room: { from: number; until: number }) {
    // a new answer takes over from anything it was still playing
    this.voice.cancel("answer", now);
    this.voice.cancel("lead", now);
    this.answerAt = this.play(this.phrase, room.from, "answer", room.until);
  }

  /** Keeps the next bar of the groove planned while you're playing, and lets it go when you stop. */
  private groove(now: number) {
    const period = this.beat.period!;
    const home = this.keys.home;
    const beats = this.beatsPerBar;
    const bar = period * beats;
    if (home === null || this.downbeat === null || now - this.lastStart > bar * GROOVE_BARS) {
      this.voice.cancel("groove", now);
      return;
    }
    if (this.voice.hasPlanned("groove")) return;
    const next = this.downbeat + Math.ceil((now + 0.05 - this.downbeat) / bar) * bar;
    const root = GROOVE_LOW + ((((home - GROOVE_LOW) % 12) + 12) % 12);
    // in 4: home on beat 1 and the fifth on 3; in 3: home on 1, held, and the fifth on 3
    const fifthAt = 2;
    const notes: [number, number, number][] = [
      [root, next, period * (fifthAt - 0.2)],
      [root + 7, next + period * fifthAt, period * (beats - fifthAt - 0.2)],
    ];
    for (const [midi, at, length] of notes) this.voice.plan(midi, at, length, "groove", midi === root ? 0.3 : 0.25);
    log("planned", { role: "groove", notes, beatsPerBar: beats });
  }

  /** An idea of its own, phrased the same way from something you played earlier, starting on the next bar. */
  private lead(now: number) {
    const period = this.beat.period!;
    const bar = this.beat.anchor + Math.ceil(this.beat.position(now + 0.05) / 4) * 4 * period;
    this.leadAt = this.play(this.motif, bar, "lead");
  }

  /** Plays a reply to `phrase` from `earliest` on, moved by whole beats so it stays in place. Returns its start. */
  private play(phrase: Played[], earliest: number, role: "answer" | "lead", until = Infinity) {
    const call = phrase.map((played) => ({
      pitch: Math.max(...played.pitches),
      start: played.start,
      end: played.end ?? played.start + 0.3,
    }));
    const grid = this.grid;
    // Its rhythm keeps your phrase's place in the beat, so it may start a little after `earliest`. If that
    // pushes the end past `until`, it composes again with that much less room.
    const startOf = (at: number) =>
      grid ? at + Math.ceil((earliest - at - 0.001) / grid.period) * grid.period : earliest;
    let { at, notes } = composeAnswer(call, this.keys.palette, grid, until - earliest);
    let start = startOf(at);
    if (start > earliest + 0.01 && until < Infinity) {
      ({ at, notes } = composeAnswer(call, this.keys.palette, grid, until - start));
      start = startOf(at);
    }
    if (!notes.length) return start;
    // move the whole line by octaves into its range, so it keeps its shape
    const middle = notes.reduce((sum, note) => sum + note.midi, 0) / notes.length;
    const octaves = 12 * Math.round((within(Math.round(middle)) - Math.round(middle)) / 12);
    for (const note of notes) {
      this.voice.plan(within(note.midi + octaves), start + note.offset, note.duration, role, note.accent ? 0.5 : 0.4);
    }
    log("planned", {
      role,
      notes: notes.map((note) => [
        within(note.midi + octaves),
        +(start + note.offset).toFixed(3),
        +note.duration.toFixed(3),
      ]),
      period: grid?.period,
      anchor: grid?.anchor,
    });
    return start;
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

  /** It plays along only once it's confident of both your key and your tempo. */
  get ready() {
    return Boolean(this.keys.confident && this.beat.locked);
  }

  /** Its current guess, with a question mark until it's sure. */
  get keyLabel() {
    const guess = this.keys.key;
    if (!guess) {
      const home = this.keys.home;
      return home === null ? null : `${NOTE_NAMES[home]} · home`;
    }
    return `${keyName(guess)}${this.keys.trusted ? "" : "?"}`;
  }

  dispose() {
    this.listener.dispose();
    this.voice.dispose();
  }
}
