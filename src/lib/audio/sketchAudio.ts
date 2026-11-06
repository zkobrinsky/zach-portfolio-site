import { CHORD_MIDI, midiToFrequency, randomNote } from "./windChimes";

/*
  The sound of the p5 sketches, with the same notes and envelope as the originals. Those used p5.sound, which
  kept every oscillator it ever made. Here each note is a one-shot that the browser frees when it ends.
*/
/** p5's 0.2 master volume, times the 0.707 its centered pan applied to every sound. */
const MASTER_VOLUME = 0.14;
const NOTE_VOLUME = 0.3;
const ATTACK = 0.75;
const DECAY = 1.5;
const RING_LEVEL = 0.2;
const RELEASE = 1;

const DRONE_MIDI = [CHORD_MIDI[0], CHORD_MIDI[2]];
const DRONE_VOLUME = 0.5;
const TREMOLO_DEPTH = 0.2;
const TREMOLO_HZ = 0.15;

export type SketchAudio = ReturnType<typeof createSketchAudio>;

export function createSketchAudio() {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let silent = false;
  let waiting: (() => void)[] = [];

  const sync = () => {
    if (!context) return;
    if (silent) {
      context.suspend().catch(() => {});
      return;
    }
    context.resume().then(() => waiting.splice(0).forEach((run) => run()), () => {});
  };

  const sine = (midi: number, volume: GainNode) => {
    const oscillator = context!.createOscillator();
    oscillator.frequency.value = midiToFrequency(midi);
    oscillator.connect(volume).connect(master!);
    return oscillator;
  };

  const ring = (midi: number) => {
    if (context?.state !== "running") return;
    const now = context.currentTime;
    const volume = context.createGain();
    const oscillator = sine(midi, volume);
    volume.gain.setValueAtTime(0, now);
    volume.gain.linearRampToValueAtTime(NOTE_VOLUME, now + ATTACK);
    volume.gain.linearRampToValueAtTime(NOTE_VOLUME * RING_LEVEL, now + ATTACK + DECAY);
    volume.gain.linearRampToValueAtTime(0, now + ATTACK + DECAY + RELEASE);
    oscillator.onended = () => volume.disconnect();
    oscillator.start(now);
    oscillator.stop(now + ATTACK + DECAY + RELEASE);
  };

  return {
    /** Call from a click or key press: browsers only allow sound after one. Safe to call as often as needed. */
    unlock() {
      if (!context) {
        context = new AudioContext();
        master = context.createGain();
        master.gain.value = MASTER_VOLUME;
        master.connect(context.destination);
      }
      // playing a silent blip during the interaction is what unlocks audio on iPhones
      const blip = context.createBufferSource();
      blip.buffer = context.createBuffer(1, 1, context.sampleRate);
      blip.connect(context.destination);
      blip.start();
      sync();
    },
    /** Runs once sound is actually audible, which may be right now or after the visitor unmutes. */
    whenAudible(run: () => void) {
      waiting.push(run);
      sync();
    },
    setSilent(value: boolean) {
      silent = value;
      sync();
    },
    // lower indexes are favored for the first note, which keeps the chord's bass present
    playChord() {
      ring(randomNote(CHORD_MIDI.length - 6));
      ring(randomNote(CHORD_MIDI.length - 4));
      ring(randomNote(CHORD_MIDI.length - 2));
    },
    playNote() {
      ring(randomNote(CHORD_MIDI.length - 2));
    },
    /** Two low tones that swell very slowly and never stop. */
    startDrone() {
      if (!context) return;
      const tremolo = context.createOscillator();
      const depth = context.createGain();
      tremolo.frequency.value = TREMOLO_HZ;
      depth.gain.value = TREMOLO_DEPTH;
      tremolo.connect(depth);
      tremolo.start();
      for (const midi of DRONE_MIDI) {
        const volume = context.createGain();
        volume.gain.value = DRONE_VOLUME;
        depth.connect(volume.gain);
        sine(midi, volume).start();
      }
    },
    stop() {
      waiting = [];
      context?.close().catch(() => {});
      context = null;
      master = null;
    },
  };
}
