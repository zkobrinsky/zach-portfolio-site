import { type Palette, pitchClass, scaleStep, snapToScale, stepsBetween } from "./theory";

/*
  How the buddy answers a phrase, the way call-and-response works between musicians:

    rhythm   your rhythm on the beat grid, but simplified: it's snapped to eighth notes and notes sharing an
             eighth are merged, so a run of sixteenths comes back as an easier line. It keeps where in the beat
             you started, so a phrase that began on the "and" is answered on an "and".
    melody   same start, new ending: the first half of your phrase, then a line that walks by step to a
             resolution, using only notes you've been playing. Until it has heard enough, it echoes you.
    ending   a cadence: the last note lands on a beat, is held, and is approached by step. If you ended away
             from home, it resolves to home. If you ended on home, it answers on the fifth: a question back.
*/
export type CallNote = { pitch: number; start: number; end: number };
export type AnswerNote = { midi: number; offset: number; duration: number; accent: boolean };
/** A beat to play to: its length, and the time of any one beat. */
export type Grid = { period: number; anchor: number };

const MAX_NOTES = 8;
const MAX_BEATS = 8;
/** Without a beat, how long the held final note is at least. */
const FINAL_SECONDS = 0.7;
/** A small gap between notes, so they speak clearly. */
const LEGATO = 0.92;

/**
 * The answer's notes, timed from `at`: where your phrase's first note falls on the grid (or when it was
 * played, without one). Moving `at` by whole beats keeps the answer in the same place in the beat.
 */
export function composeAnswer(
  call: CallNote[],
  palette: Palette | null,
  grid: Grid | null,
  /** The longest the answer may last (seconds), so it fits the room you leave. */
  maxSpan = Infinity,
): { at: number; notes: AnswerNote[] } {
  if (!call.length) return { at: 0, notes: [] };
  const { at, offsets, ends, span, kept } = grid ? onGrid(call, grid, maxSpan) : freeTime(call);
  const count = offsets.length;
  const pitches = kept.map((note) => note.pitch);
  const melody = palette ? answerMelody(pitches, palette) : pitches.slice();
  const finalLength = grid
    ? Math.min(
        Math.max(grid.period, span - offsets[count - 1]),
        Math.max(grid.period / 2, maxSpan - offsets[count - 1]),
      )
    : Math.max(FINAL_SECONDS, (ends[count - 1] - offsets[count - 1]) * 1.5);

  const notes = melody.map((midi, i) => {
    const last = i === count - 1;
    const room = last ? finalLength : Math.min(offsets[i + 1] - offsets[i], ends[i] - offsets[i]) * LEGATO;
    return { midi, offset: offsets[i], duration: Math.max(0.1, room), accent: i === 0 || last };
  });
  return { at, notes };
}

/** Your timing as you played it. */
function freeTime(call: CallNote[]) {
  const kept = call.slice(-MAX_NOTES);
  const at = kept[0].start;
  const offsets = kept.map((note) => note.start - at);
  const ends = kept.map((note) => note.end - at);
  return { at, offsets, ends, span: ends[ends.length - 1], kept };
}

/** Your rhythm snapped to eighths, one note per eighth, with the last note landing on a beat. */
function onGrid(call: CallNote[], { period, anchor }: Grid, maxSpan: number) {
  const eighth = period / 2;
  const slot = (time: number) => Math.round((time - anchor) / eighth);
  // one note per eighth: the first one to land in it
  let kept: { note: CallNote; slot: number; end: number }[] = [];
  for (const note of call) {
    const at = slot(note.start);
    if (kept.length && at <= kept[kept.length - 1].slot) continue;
    kept.push({ note, slot: at, end: Math.max(at + 1, slot(note.end)) });
  }
  kept = kept.slice(-MAX_NOTES);
  kept = kept.filter((entry) => entry.slot - kept[0].slot < MAX_BEATS * 2);
  // short of room, it answers the end of your phrase, not all of it: the last notes, ending a beat in
  const maxEighths = Math.floor(maxSpan / eighth);
  while (kept.length > 1 && kept[kept.length - 1].slot + 2 - kept[0].slot > maxEighths) kept.shift();
  // the last note lands on a beat (an even eighth), after the one before it
  const last = kept[kept.length - 1];
  const before = kept[kept.length - 2]?.slot ?? -Infinity;
  last.slot += Math.abs(last.slot % 2);
  if (last.slot <= before) last.slot = before + 2 - Math.abs((before + 2) % 2);
  for (let i = 0; i < kept.length - 1; i++) kept[i].end = Math.min(kept[i].end, kept[i + 1].slot);

  const first = kept[0].slot;
  const spanEnd = Math.max(last.slot + 2, Math.ceil(Math.max(...kept.map((entry) => entry.end)) / 2) * 2);
  return {
    at: anchor + first * eighth,
    offsets: kept.map((entry) => (entry.slot - first) * eighth),
    ends: kept.map((entry) => (entry.end - first) * eighth),
    span: (spanEnd - first) * eighth,
    kept: kept.map((entry) => entry.note),
  };
}

/**
 * Your opening, then a new ending that walks by step to somewhere restful: home if you ended away from it,
 * the fifth if you ended home. The second half of a question-and-answer pair.
 */
function answerMelody(pitches: number[], { tonic, pcs }: Palette) {
  const scale = pcs.includes(tonic) ? pcs : [...pcs, tonic];
  const count = pitches.length;
  const keep = Math.ceil(count / 2);
  const melody = pitches.slice(0, keep).map((pitch) => snapToScale(pitch, scale));
  const slots = count - keep;
  if (!slots) return melody;

  const fifth = (tonic + 7) % 12;
  const target = pitchClass(pitches[count - 1]) === tonic && scale.includes(fifth) ? fifth : tonic;
  const from = melody[keep - 1];
  // the nearest one, falling to it on a tie, the way cadences settle
  let final = from;
  for (let distance = 0; distance <= 6; distance++) {
    if (pitchClass(from - distance) === target) {
      final = from - distance;
      break;
    }
    if (pitchClass(from + distance) === target) {
      final = from + distance;
      break;
    }
  }
  // Fill the notes left so the line keeps moving and arrives by step. With more notes than steps home it
  // turns away and comes back, or skips a third; with fewer, it skips toward home.
  const onward = Math.sign(from - (melody[keep - 2] ?? from)) || 1;
  let note = from;
  for (let left = slots; left >= 1; left--) {
    const distance = stepsBetween(note, final, scale);
    const toward = Math.sign(distance) || onward;
    let move: number;
    if (left === 1) move = distance;
    else if (Math.abs(distance) >= left) move = toward * Math.ceil(Math.abs(distance) / left);
    else if ((left - Math.abs(distance)) % 2 === 0) move = -Math.sign(distance) || onward;
    else move = toward * 2;
    note = scaleStep(note, move, scale);
    melody.push(note);
  }
  return melody;
}
