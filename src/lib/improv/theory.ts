/*
  The music theory the buddy works from: note names, keys, and chords. All pitches are MIDI numbers
  (60 is middle C) and pitch classes are 0..11 (0 is C).
*/
export const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

export const pitchClass = (midi: number) => ((Math.round(midi) % 12) + 12) % 12;
export const hzToMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440);
export const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
export const noteName = (midi: number) => `${NOTE_NAMES[pitchClass(midi)]}${Math.floor(Math.round(midi) / 12) - 1}`;

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

export type Key = { tonic: number; minor: boolean; confidence: number };

export const keyName = (key: Key) => `${NOTE_NAMES[key.tonic]} ${key.minor ? "minor" : "major"}`;
export const scaleOf = (key: Key) => (key.minor ? MINOR_SCALE : MAJOR_SCALE).map((step) => (step + key.tonic) % 12);
/** The key's home chord, which phrases like to end on. */
export const tonicTriad = (key: Key) => [0, key.minor ? 3 : 4, 7].map((step) => (step + key.tonic) % 12);

/** Moves a pitch onto the nearest note of the key, preferring to go the given way on a tie. */
export function snapToScale(midi: number, key: Key | null, prefer: 1 | -1 = 1) {
  const rounded = Math.round(midi);
  if (!key) return rounded;
  const scale = scaleOf(key);
  for (let distance = 0; distance < 12; distance++) {
    for (const direction of [prefer, -prefer]) {
      const candidate = rounded + direction * distance;
      if (scale.includes(pitchClass(candidate))) return candidate;
    }
  }
  return rounded;
}

/** How many scale steps from one note to another (both snapped to the key): C to E in C major is +2. */
export function stepsBetween(from: number, to: number, key: Key | null) {
  if (!key) return Math.round((to - from) / 2);
  const scale = scaleOf(key);
  const a = snapToScale(from, key), b = snapToScale(to, key);
  let steps = 0;
  for (let note = Math.min(a, b) + 1; note <= Math.max(a, b); note++) if (scale.includes(pitchClass(note))) steps++;
  return b >= a ? steps : -steps;
}

/** Steps along the key's scale: +2 from a scale note is a third above it. */
export function scaleStep(midi: number, steps: number, key: Key | null) {
  if (!key) return Math.round(midi) + steps * 2;
  const scale = scaleOf(key);
  let note = snapToScale(midi, key);
  const direction = Math.sign(steps);
  for (let taken = 0; taken < Math.abs(steps); ) {
    note += direction;
    if (scale.includes(pitchClass(note))) taken++;
  }
  return note;
}

export type Chord = { root: number; quality: string; pcs: number[] };

const CHORD_SHAPES: { quality: string; steps: number[] }[] = [
  { quality: "", steps: [0, 4, 7] },
  { quality: "m", steps: [0, 3, 7] },
  { quality: "7", steps: [0, 4, 7, 10] },
  { quality: "maj7", steps: [0, 4, 7, 11] },
  { quality: "m7", steps: [0, 3, 7, 10] },
  { quality: "sus4", steps: [0, 5, 7] },
];

export const chordName = (chord: Chord) => `${NOTE_NAMES[chord.root]}${chord.quality}`;

/** The chord that best explains a chroma (how loud each pitch class is, 0..1). */
export function matchChord(chroma: number[]): Chord | null {
  let best: { chord: Chord; score: number } | null = null;
  for (let root = 0; root < 12; root++) {
    for (const { quality, steps } of CHORD_SHAPES) {
      const pcs = steps.map((step) => (step + root) % 12);
      const inside = pcs.reduce((sum, pc) => sum + chroma[pc], 0) / pcs.length;
      const outside = chroma.reduce((sum, value, pc) => (pcs.includes(pc) ? sum : sum + value), 0) / (12 - pcs.length);
      // bigger chords explain more by default, so they have to earn their extra note
      const score = inside - outside - (pcs.length - 3) * 0.06;
      if (!best || score > best.score) best = { chord: { root, quality, pcs }, score };
    }
  }
  return best && best.score > 0.35 ? best.chord : null;
}
