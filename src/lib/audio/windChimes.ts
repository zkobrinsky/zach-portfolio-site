/*
  Digital wind chimes, carried over from the Expanding Universe piece.

  The notes are pure sine waves picked at random from one chord, so any combination sounds good together.
  A soft three-note chord rings every 20 seconds or so, with single notes between them.

  Memory: the original made brand-new sound objects for every note and never released them, so it
  slowly choked. Here a small fixed set of voices is built once and hums silently forever. Playing a note
  just turns one voice up and back down, so nothing is ever created or thrown away.
*/
const CHORD_MIDI = [47, 52, 56, 59, 63, 66, 68, 71, 73, 76, 80, 88];
const VOICES = 8;
const MASTER_VOLUME = 0.11;
/** Inside the helmet the chimes drop to a faint trace of this share of their volume. */
const HELMET_VOLUME = 0.06;
const VOLUME_CHANGE_SECONDS = 0.5;
const NOTE_VOLUME = 0.3;
const REVERB_SECONDS = 4;
const REVERB_MIX = 0.45;

/** The shape of a note in seconds: swell in, fall to a quiet ring, fade out. */
const ATTACK = 0.75;
const DECAY = 1.5;
const RING_LEVEL = 0.2;
const RELEASE_AT = 2.5;
const RELEASE = 1;

const midiToFrequency = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const randomBetween = (low: number, high: number) => low + Math.random() * (high - low);
const randomNote = (highestIndex: number) => CHORD_MIDI[1 + Math.floor(Math.random() * highestIndex)];

/** A reverb "room", made from a burst of noise that dies away. */
function reverbImpulse(context: AudioContext) {
  const length = Math.floor(context.sampleRate * REVERB_SECONDS);
  const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const samples = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) samples[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
  }
  return impulse;
}
export function createWindChimes() {
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = MASTER_VOLUME;
  master.connect(context.destination);

  const reverb = context.createConvolver();
  reverb.buffer = reverbImpulse(context);
  const wet = context.createGain();
  wet.gain.value = REVERB_MIX;
  reverb.connect(wet).connect(master);

  const voices = Array.from({ length: VOICES }, () => {
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    oscillator.type = "sine";
    volume.gain.value = 0;
    oscillator.connect(volume);
    volume.connect(master);
    volume.connect(reverb);
    oscillator.start();
    return { oscillator, volume };
  });

  let nextVoice = 0;
  const ring = (midi: number) => {
    const { oscillator, volume } = voices[nextVoice];
    nextVoice = (nextVoice + 1) % VOICES;
    const now = context.currentTime;
    const gain = volume.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(0, now);
    oscillator.frequency.setValueAtTime(midiToFrequency(midi), now);
    gain.linearRampToValueAtTime(NOTE_VOLUME, now + ATTACK);
    gain.linearRampToValueAtTime(NOTE_VOLUME * RING_LEVEL, now + ATTACK + DECAY);
    gain.setValueAtTime(NOTE_VOLUME * RING_LEVEL, now + RELEASE_AT);
    gain.linearRampToValueAtTime(0, now + RELEASE_AT + RELEASE);
  };

  // lower indexes are favored for the first note, which keeps the chord's bass present
  const playChord = () => {
    ring(randomNote(CHORD_MIDI.length - 6));
    ring(randomNote(CHORD_MIDI.length - 4));
    ring(randomNote(CHORD_MIDI.length - 2));
  };
  const playNote = () => ring(randomNote(CHORD_MIDI.length - 2));

  const timers = new Set<ReturnType<typeof setTimeout>>();
  const repeat = (play: () => void, low: number, high: number) => {
    const tick = () => {
      if (context.state === "running") play();
      const timer = setTimeout(() => {
        timers.delete(timer);
        tick();
      }, randomBetween(low, high) * 1000);
      timers.add(timer);
    };
    tick();
  };
  // The loops begin the moment audio is truly running, however that came about.
  let looping = false;
  const startLoops = () => {
    if (looping || context.state !== "running") return;
    looping = true;
    repeat(playChord, 18, 24);
    const firstNote = setTimeout(() => repeat(playNote, 4.5, 9), 5000);
    timers.add(firstNote);
  };
  context.addEventListener("statechange", startLoops);

  // Whenever the chimes become audible again, a chord rings right then, instead of leaving silence
  // until the next random note. The volume rises first, so it isn't swallowed.
  let insideHelmet = false;
  let muted = false;
  const comeBack = () => {
    if (!insideHelmet && !muted && context.state === "running") playChord();
  };

  return {
    /** Browsers only allow sound after the visitor interacts. Safe to call as often as needed. */
    start() {
      // playing a silent blip during the interaction is what unlocks audio on iPhones
      const blip = context.createBufferSource();
      blip.buffer = context.createBuffer(1, 1, context.sampleRate);
      blip.connect(context.destination);
      blip.start();
      void context.resume().then(startLoops, () => {});
    },
    get running() {
      return context.state === "running";
    },
    /** Quiet the chimes while we're inside the astronaut's helmet. */
    setInsideHelmet(inside: boolean) {
      const leaving = insideHelmet && !inside;
      insideHelmet = inside;
      const level = MASTER_VOLUME * (inside ? HELMET_VOLUME : 1);
      master.gain.setTargetAtTime(level, context.currentTime, VOLUME_CHANGE_SECONDS / 3);
      if (leaving) comeBack();
    },
    setMuted(silent: boolean) {
      const unmuting = muted && !silent;
      muted = silent;
      if (silent) void context.suspend();
      else {
        void context.resume().then(() => {
          startLoops();
          if (unmuting) comeBack();
        }, () => {});
      }
    },
    stop() {
      timers.forEach(clearTimeout);
      void context.close();
    },
  };
}
