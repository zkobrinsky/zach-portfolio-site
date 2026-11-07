import { type Key, pitchClass, scaleStep, stepsBetween } from "./theory";

/*
  How the buddy answers a phrase, the way call-and-response works between musicians:

    rhythm   your rhythm, on the beat grid, over the same number of beats, so it's recognizably a reply
    melody   your melody's shape repeated a third away (a sequence), keeping leaps tame
    ending   a cadence: the last note lands on a beat, is held, and is approached by step. If you ended away
             from home, it resolves to home. If you ended on home, it answers on the fifth: a question back.
*/
export type CallNote = { pitch: number; start: number; end: number };
export type AnswerNote = { midi: number; offset: number; duration: number; accent: boolean };

const MAX_NOTES = 8;
const MAX_BEATS = 8;
/** Without a beat, how long the held final note is at least. */
const FINAL_SECONDS = 0.7;
/** Biggest jump allowed between neighboring notes before it's folded back an octave. */
const MAX_LEAP = 7;
/** A small gap between notes, so they speak clearly. */
const LEGATO = 0.92;

export function composeAnswer(call: CallNote[], key: Key | null, period: number | null): AnswerNote[] {
  const notes = call.slice(-MAX_NOTES);
  if (!notes.length) return [];
  const first = notes[0].start;

  // rhythm
  let offsets = notes.map((note) => note.start - first);
  let ends = notes.map((note) => note.end - first);
  let span = ends[ends.length - 1];
  if (period) {
    const eighth = period / 2;
    offsets = offsets.map((offset) => Math.round(offset / eighth) * eighth);
    for (let i = 1; i < offsets.length; i++) offsets[i] = Math.max(offsets[i], offsets[i - 1] + eighth);
    ends = ends.map((end, i) => Math.max(offsets[i] + eighth, Math.round(end / eighth) * eighth));
    const keep = offsets.filter((offset) => offset < period * MAX_BEATS).length;
    offsets = offsets.slice(0, keep);
    ends = ends.slice(0, keep);
    span = Math.min(MAX_BEATS, Math.max(1, Math.ceil(ends[ends.length - 1] / period - 0.01))) * period;
  }
  const count = offsets.length;
  const pitches = notes.slice(0, count).map((note) => note.pitch);

  // melody: the same shape, a third away, toward the middle of the range
  const average = pitches.reduce((sum, pitch) => sum + pitch, 0) / count;
  const shift = average > 67 ? -2 : 2;
  const start = scaleStep(pitches[0], shift, key);
  const melody = pitches.map((pitch) => scaleStep(start, stepsBetween(pitches[0], pitch, key), key));
  for (let i = 1; i < count; i++) {
    while (melody[i] - melody[i - 1] > MAX_LEAP) melody[i] -= 12;
    while (melody[i - 1] - melody[i] > MAX_LEAP) melody[i] += 12;
  }

  // ending: home if you ended away from it, the fifth if you ended home
  const tonic = key ? key.tonic : pitchClass(pitches[0]);
  const target = pitchClass(pitches[count - 1]) === tonic ? (tonic + 7) % 12 : tonic;
  const before = count > 1 ? melody[count - 2] : melody[0];
  let final = before;
  for (let distance = 0; distance <= 6; distance++) {
    if (pitchClass(before - distance) === target) {
      final = before - distance;
      break;
    }
    if (pitchClass(before + distance) === target) {
      final = before + distance;
      break;
    }
  }
  melody[count - 1] = final;
  // step into it, unless the line already does; from the side it was coming from, without repeating a note
  if (count >= 3 && (Math.abs(melody[count - 2] - final) > 2 || melody[count - 2] === final)) {
    const side = melody[count - 3] > final ? 1 : -1;
    let approach = scaleStep(final, side, key);
    if (approach === melody[count - 3]) approach = scaleStep(final, -side, key);
    melody[count - 2] = approach;
  }

  // the final note lands on a beat and rings to the end of the phrase
  const finalOffset = period ? Math.max(offsets[count - 2] ?? 0, Math.ceil(offsets[count - 1] / period - 0.01) * period) : offsets[count - 1];
  if (count > 1 && finalOffset <= offsets[count - 2]) offsets[count - 1] = offsets[count - 2] + (period ? period / 2 : 0.2);
  else offsets[count - 1] = finalOffset;
  const finalLength = period ? Math.max(period, span - offsets[count - 1]) : Math.max(FINAL_SECONDS, (ends[count - 1] - offsets[count - 1]) * 1.5);

  return melody.map((midi, i) => {
    const last = i === count - 1;
    const room = last ? finalLength : Math.min(offsets[i + 1] - offsets[i], ends[i] - offsets[i]) * LEGATO;
    return { midi, offset: offsets[i], duration: Math.max(0.1, room), accent: i === 0 || last };
  });
}
