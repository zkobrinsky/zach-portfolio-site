/*
  Finds the beat in what the player has played. It tries every tempo from 50 to 200 BPM and every alignment,
  and scores how well the note starts land on that grid's beats and half-beats. Once one fits well enough, the
  beat is locked, and later notes keep nudging it so it follows the player if they speed up or slow down.
*/
const SLOWEST_BEAT = 60 / 50;
const FASTEST_BEAT = 60 / 200;
const STEP = 0.004;
/** How far off the grid (in seconds) a note can land and still mostly count as on it. */
const TIMING_SLOP = 0.035;
/** Only recent notes count, so the tempo can change. */
const REMEMBER_SECONDS = 14;
const MAX_ONSETS = 24;
const MIN_ONSETS_TO_LOCK = 6;
const LOCK_FIT = 0.55;
const HALF_BEAT_WEIGHT = 0.9;

export class BeatTracker {
  /** Seconds per beat, once locked. */
  period: number | null = null;
  /** The audio-clock time of some beat; every other beat is a whole number of periods from it. */
  anchor = 0;
  fit = 0;
  /** When the beat locked, for the "got it" moment. */
  lockedAt: number | null = null;
  private onsets: number[] = [];

  get locked() {
    return this.period !== null;
  }
  get bpm() {
    return this.period ? Math.round(60 / this.period) : null;
  }

  addOnset(time: number) {
    this.onsets.push(time);
    this.onsets = this.onsets.filter((onset) => time - onset < REMEMBER_SECONDS).slice(-MAX_ONSETS);
    if (this.onsets.length >= 4) this.estimate(time);
  }

  /** Where `time` falls in beats from the anchor: 3.5 is halfway through the fourth beat. */
  position(time: number) {
    return this.period ? (time - this.anchor) / this.period : 0;
  }

  /** The first grid line at or after `time`, on a grid of `division` steps per beat. */
  next(time: number, division = 1) {
    if (!this.period) return time;
    const step = this.period / division;
    return this.anchor + Math.ceil((time - this.anchor - 0.001) / step) * step;
  }

  private estimate(now: number) {
    let best = { period: 0, anchor: 0, fit: 0, score: 0 };
    for (let period = FASTEST_BEAT; period <= SLOWEST_BEAT; period += STEP) {
      // a gentle preference for tempos people actually play at, around 100 BPM
      const prior = Math.exp(-0.5 * (Math.log2(60 / period / 100) / 0.8) ** 2);
      for (const anchor of this.onsets) {
        let total = 0;
        for (const onset of this.onsets) {
          const beats = (onset - anchor) / period;
          const offBeat = Math.abs(beats - Math.round(beats)) * period;
          const offHalf = Math.abs(beats * 2 - Math.round(beats * 2)) * (period / 2);
          // Eighth notes count nearly as much as beats. Otherwise any phrase with eighths fits double time best,
          // and a 72 BPM groove reads as 144. With both fitting, the tempo preference decides.
          total += Math.max(Math.exp(-0.5 * (offBeat / TIMING_SLOP) ** 2), HALF_BEAT_WEIGHT * Math.exp(-0.5 * (offHalf / TIMING_SLOP) ** 2));
        }
        const fit = total / this.onsets.length;
        if (fit * prior > best.score) best = { period, anchor, fit, score: fit * prior };
      }
    }
    if (!best.period) return;

    if (!this.period) {
      if (this.onsets.length >= MIN_ONSETS_TO_LOCK && best.fit >= LOCK_FIT) {
        this.period = best.period;
        this.anchor = best.anchor;
        this.fit = best.fit;
        this.lockedAt = now;
      }
      return;
    }
    // once locked, follow drift smoothly, but ignore a sudden reading at a very different tempo
    if (Math.abs(best.period - this.period) / this.period < 0.1 && best.fit >= LOCK_FIT * 0.8) {
      const beats = Math.round((best.anchor - this.anchor) / this.period);
      const drift = best.anchor - (this.anchor + beats * this.period);
      this.period += (best.period - this.period) * 0.3;
      this.anchor += drift * 0.3;
      this.fit = best.fit;
    }
  }
}
