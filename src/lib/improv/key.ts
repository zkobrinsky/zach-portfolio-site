import { type Key, pitchClass } from "./theory";

/*
  Works out what key you're playing in, and sticks with it.

  Evidence is time, not note count: every moment a note sounds adds to its pitch class, so the notes you hold
  and lean on matter more than passing ones. A note you end a phrase on gets extra weight, since phrases
  tend to come to rest on home, and so does the lowest note of a chord (usually its root).

  Each of the 24 keys is scored against two sets of key profiles: Krumhansl–Kessler, from listening
  experiments, and Aarden–Essen, counted from thousands of folk melodies, which knows single-line melodies
  better and helps tell a major key from its relative minor.

  It only changes its mind when another key has clearly won for a while, so the harmony doesn't lurch about.
*/
const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const AE_MAJOR = [17.7661, 0.145624, 14.9265, 0.160186, 19.8049, 11.3587, 0.291248, 22.062, 0.145624, 8.15494, 0.232998, 4.95122];
const AE_MINOR = [18.2648, 0.737619, 14.0499, 16.8599, 0.702494, 14.4362, 0.702494, 18.6161, 4.56621, 1.93186, 7.37619, 1.75623];

/** Old evidence fades by half over this many seconds. */
const HALF_LIFE = 30;
/** Seconds of sounding notes before it guesses at all. */
const MIN_EVIDENCE = 2.5;
/** How well the best key must fit before it's trusted for harmony. */
const TRUST = 0.62;
/** A new key has to beat the current one by this much... */
const SWITCH_MARGIN = 0.06;
/** ...for this long. */
const SWITCH_SECONDS = 2;
const PHRASE_END_BONUS = 1;
const CHORD_WEIGHT = 0.7;

function correlation(a: number[], b: number[]) {
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const ma = mean(a), mb = mean(b);
  let top = 0, da = 0, db = 0;
  for (let i = 0; i < 12; i++) {
    top += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? top / Math.sqrt(da * db) : 0;
}

/** Every key, best fit first. */
export function rankKeys(weights: number[]): Key[] {
  const keys: Key[] = [];
  for (let tonic = 0; tonic < 12; tonic++) {
    const rotated = weights.map((_, degree) => weights[(degree + tonic) % 12]);
    keys.push({ tonic, minor: false, confidence: (correlation(rotated, KK_MAJOR) + correlation(rotated, AE_MAJOR)) / 2 });
    keys.push({ tonic, minor: true, confidence: (correlation(rotated, KK_MINOR) + correlation(rotated, AE_MINOR)) / 2 });
  }
  return keys.sort((a, b) => b.confidence - a.confidence);
}

const same = (a: Key | null, b: Key | null) => Boolean(a && b && a.tonic === b.tonic && a.minor === b.minor);

export class KeyTracker {
  /** The key it believes, or null before it has heard enough. */
  key: Key | null = null;
  private weights = new Array<number>(12).fill(0);
  private evidence = 0;
  private lastTime: number | null = null;
  private challenger: { key: Key; since: number } | null = null;

  /** The key, but only when it's sure enough to harmonize in it. */
  get trusted() {
    return this.key && this.key.confidence >= TRUST ? this.key : null;
  }

  /** Call once a frame with whatever is sounding: one note, or a chord's notes (lowest first). */
  update(now: number, sounding: { pitches: number[]; chord: boolean } | null) {
    const dt = this.lastTime === null ? 0 : Math.min(0.1, now - this.lastTime);
    this.lastTime = now;
    const fade = 0.5 ** (dt / HALF_LIFE);
    for (let pc = 0; pc < 12; pc++) this.weights[pc] *= fade;
    this.evidence *= fade;
    if (sounding) {
      sounding.pitches.forEach((midi, i) => {
        // a chord's lowest note is usually its root, which says the most about the key
        const weight = sounding.chord ? CHORD_WEIGHT * (i === 0 ? 2 : 1) : 1;
        this.weights[pitchClass(midi)] += dt * weight;
      });
      this.evidence += dt;
    }
    this.decide(now);
  }

  /** The note a phrase came to rest on: phrases tend to end on home. */
  phraseEnded(lastPitch: number) {
    this.weights[pitchClass(lastPitch)] += PHRASE_END_BONUS;
  }

  private decide(now: number) {
    if (this.evidence < MIN_EVIDENCE) return;
    const ranked = rankKeys(this.weights);
    const best = ranked[0];
    if (!this.key) {
      this.key = best;
      return;
    }
    const current = ranked.find((key) => same(key, this.key))!;
    this.key = current; // keep its confidence up to date
    if (same(best, current) || best.confidence - current.confidence < SWITCH_MARGIN) {
      this.challenger = null;
      return;
    }
    if (!same(this.challenger?.key ?? null, best)) this.challenger = { key: best, since: now };
    else if (now - this.challenger!.since >= SWITCH_SECONDS) {
      this.key = best;
      this.challenger = null;
    }
  }
}
