import { type Key, type Palette, pitchClass, scaleOf } from "./theory";

/*
  Works out what key you're in, and your tuning, together, the way a musician hears a singer.

  Pitch alone can't do it. Singing unaccompanied, people drift and their steps aren't even: in one take a
  D♭ came out 40 cents flat while the B♭ and A♭ next to it were 40 cents sharp. No single tuning puts every
  one of those on the right semitone. But one key does: snap each note to the nearest note of D♭ major and
  every one comes out right. So for every key and every tuning (in steps of 2 cents) it measures how far
  your recent held notes sit from that key's notes, and the closest fit wins.

  A key and its relative minor have the same notes, so they fit equally well. Which one is home comes from
  key profiles (Krumhansl–Kessler from listening experiments, Aarden–Essen counted from folk melodies), which
  know which notes a melody leans on in each.

  A short melody often fits two or three neighbouring keys about equally (one that skips G♭ fits D♭ major and
  A♭ major alike; mi-re-do fits C, G and F major). Among the keys that fit about as well as the best, the
  profiles pick the likeliest home, and it plays only from the notes those keys share (for mi-re-do, C D E G
  A), so it can't pick the wrong one of the notes they disagree on.
  Confidence is how tightly your notes sit on the winner's notes. It only changes its mind when another key
  fits clearly better, so the harmony doesn't lurch about.
*/
const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const AE_MAJOR = [
  17.7661, 0.145624, 14.9265, 0.160186, 19.8049, 11.3587, 0.291248, 22.062, 0.145624, 8.15494, 0.232998, 4.95122,
];
const AE_MINOR = [
  18.2648, 0.737619, 14.0499, 16.8599, 0.702494, 14.4362, 0.702494, 18.6161, 4.56621, 1.93186, 7.37619, 1.75623,
];

/** A note you held: its pitch as sung (MIDI, fractional, on the A440 grid) and how long. */
export type HeldNote = { pitch: number; seconds: number };

/** How many recent held notes it fits to, and how much each older one counts less. */
const MEMORY = 12;
const AGE_FADE = 0.88;
/** Before this many notes, over at least this many different pitches, it doesn't guess. */
const MIN_NOTES = 5;
/**
 * With only one or two different pitches there's no key to find, but there's still something to go on: the
 * note you keep coming back to is almost certainly home. After this many held notes it plays from your
 * notes plus home's fifth, which fits under nearly anything, until you give it enough for a key.
 */
const MIN_NOTES_FEW = 3;
const MIN_PITCHES = 3;
const TUNING_STEP = 0.02;
/** How far (root mean square, in semitones) your notes may sit from the key's for no confidence at all. */
const LOOSEST = 0.5;
/** Confidence (0 to 1) needed to play in the key: notes within about 0.3 of a semitone on average, as loose as unaccompanied singing usually is. */
const TRUST = 0.4;
/** Keys fitting within this much of the best (mean squared semitones) are as good, for choosing home. */
const AS_GOOD = 0.005;
/** Once it has a key, another must fit this much better before it switches. */
const SWITCH_RATIO = 0.7;
/** A note outside the key this close (semitones) to its own pitch is meant, not a stray in-key note. */
const SQUARELY = 0.2;
/** A long note counts more than a short one, up to this many seconds. */
const LONGEST = 1;

function correlation(a: number[], b: number[]) {
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const ma = mean(a),
    mb = mean(b);
  let top = 0,
    da = 0,
    db = 0;
  for (let i = 0; i < 12; i++) {
    top += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? top / Math.sqrt(da * db) : 0;
}

/** How well a key's profile matches how much each pitch class was used. */
function profileFit(weights: number[], key: Key) {
  const rotated = weights.map((_, degree) => weights[(degree + key.tonic) % 12]);
  return key.minor
    ? (correlation(rotated, KK_MINOR) + correlation(rotated, AE_MINOR)) / 2
    : (correlation(rotated, KK_MAJOR) + correlation(rotated, AE_MAJOR)) / 2;
}

/** Distance in semitones from a pitch to the nearest note of a scale. */
function offScale(pitch: number, scale: number[]) {
  const below = Math.floor(pitch);
  let best = Infinity;
  for (let note = below - 2; note <= below + 3; note++)
    if (scale.includes(pitchClass(note))) best = Math.min(best, Math.abs(pitch - note));
  return best;
}

/** The nearest note of the scale, unless the pitch sits squarely on a note outside it (a blue note, say). */
export function hearInKey(exact: number, scale: number[]) {
  const nearest = Math.round(exact);
  if (!scale.includes(pitchClass(nearest)) && Math.abs(exact - nearest) < SQUARELY) return nearest;
  let best = nearest;
  let distance = Infinity;
  for (let note = nearest - 2; note <= nearest + 2; note++) {
    if (!scale.includes(pitchClass(note))) continue;
    const away = Math.abs(exact - note);
    if (away < distance) {
      distance = away;
      best = note;
    }
  }
  return best;
}

type Fit = { key: Key; tuning: number; cost: number };

export class KeyTracker {
  /** Its best guess, with confidence 0 to 1, or null before it has heard enough. */
  key: Key | null = null;
  /** How far you sit from the A440 grid in this key, in semitones. */
  tuning = 0;
  /** The notes every key that fits about as well agrees on. */
  private shared: number[] = [];
  /** Before there's a key: home, and the notes it can safely play, from the one or two pitches you've used. */
  private few: Palette | null = null;

  /** Sure enough of something to play along: a key, or home from a note you keep repeating. */
  get confident() {
    return Boolean(this.trusted || this.few);
  }

  /** Home, from whichever it has. */
  get home() {
    return this.trusted?.tonic ?? this.few?.tonic ?? null;
  }
  private notes: HeldNote[] = [];

  /** The key, but only when it's sure enough to play in. */
  get trusted() {
    return this.key && this.key.confidence >= TRUST ? this.key : null;
  }

  /** The notes it plays from: the trusted key's scale, with home. */
  get palette(): Palette | null {
    const key = this.trusted;
    return key ? { tonic: key.tonic, pcs: this.shared } : this.few;
  }

  /** The scale to hear you in, once it's sure of the key. */
  get scale() {
    const key = this.trusted;
    return key ? scaleOf(key) : null;
  }

  /** Call when you finish a note you held. */
  heard(note: HeldNote) {
    this.notes.push({ pitch: note.pitch, seconds: Math.min(LONGEST, note.seconds) });
    if (this.notes.length > MEMORY) this.notes.shift();
    this.refit();
  }

  /** Home and safe notes from one or two pitches, and your tuning from how they sit. */
  private fitFew(weights: number[]) {
    // the tuning is the average of how far each note sits from A440, taken round a circle so 0.45 sharp and
    // 0.45 flat average to half a semitone off rather than to zero
    let x = 0;
    let y = 0;
    this.notes.forEach((note, i) => {
      const angle = 2 * Math.PI * (note.pitch - Math.round(note.pitch));
      x += weights[i] * Math.cos(angle);
      y += weights[i] * Math.sin(angle);
    });
    this.tuning = Math.round((Math.atan2(y, x) / (2 * Math.PI)) * 100) / 100;
    const used = new Array<number>(12).fill(0);
    this.notes.forEach((note, i) => (used[pitchClass(note.pitch - this.tuning)] += weights[i]));
    const tonic = used.indexOf(Math.max(...used));
    const pcs = used.flatMap((weight, pc) => (weight > 0 ? [pc] : []));
    this.few = { tonic, pcs: [...new Set([...pcs, (tonic + 7) % 12])] };
  }

  private refit() {
    if (this.notes.length < MIN_NOTES_FEW) return;
    const weights = this.notes.map((note, i) => note.seconds * AGE_FADE ** (this.notes.length - 1 - i));
    const distinct = new Set(this.notes.map((note) => pitchClass(note.pitch))).size;
    if (distinct < MIN_PITCHES) {
      // a key it already found still stands; otherwise it goes on what little there is
      if (!this.key) this.fitFew(weights);
      return;
    }
    if (this.notes.length < MIN_NOTES) return;
    this.few = null;
    const total = weights.reduce((sum, weight) => sum + weight, 0);

    // the best tuning for each set of scale notes (keyed by the major key that owns it)
    const fits: Fit[] = [];
    for (let tonic = 0; tonic < 12; tonic++) {
      const scale = scaleOf({ tonic, minor: false, confidence: 0 });
      let best = { tuning: 0, cost: Infinity };
      for (let tuning = -0.5; tuning < 0.5; tuning += TUNING_STEP) {
        let cost = 0;
        this.notes.forEach((note, i) => (cost += weights[i] * offScale(note.pitch - tuning, scale) ** 2));
        if (cost < best.cost) best = { tuning, cost };
      }
      fits.push({ key: { tonic, minor: false, confidence: 0 }, tuning: best.tuning, cost: best.cost / total });
    }
    fits.sort((a, b) => a.cost - b.cost);
    let best = fits[0];
    // stick with the scale it had unless another fits clearly better
    const hadTonic = this.key && (this.key.minor ? (this.key.tonic + 3) % 12 : this.key.tonic);
    const had = fits.find((fit) => fit.key.tonic === hadTonic);
    if (had && best.cost > had.cost * SWITCH_RATIO) best = had;
    const confidence = Math.max(0, 1 - Math.sqrt(best.cost) / LOOSEST);

    // home: among the scales fitting about as well, and each one's major and relative minor, the key whose
    // profile best matches the notes you leaned on
    let choice = { key: best.key, tuning: best.tuning, score: -Infinity };
    const asGood = fits.filter(
      (fit) => fit === best || (fit.cost <= best.cost + AS_GOOD && Math.abs(fit.tuning - best.tuning) < 0.15),
    );
    this.shared = scaleOf(best.key).filter((pc) => asGood.every((fit) => scaleOf(fit.key).includes(pc)));
    for (const fit of asGood) {
      const used = new Array<number>(12).fill(0);
      this.notes.forEach(
        (note, i) => (used[pitchClass(hearInKey(note.pitch - fit.tuning, scaleOf(fit.key)))] += weights[i]),
      );
      for (const key of [
        { tonic: fit.key.tonic, minor: false, confidence },
        { tonic: (fit.key.tonic + 9) % 12, minor: true, confidence },
      ]) {
        const score = profileFit(used, key);
        if (score > choice.score) choice = { key, tuning: fit.tuning, score };
      }
    }
    this.key = choice.key;
    const winner = choice;
    this.tuning = Math.round(winner.tuning * 100) / 100;
  }
}
