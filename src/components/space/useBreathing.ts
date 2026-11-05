"use client";

import { hostedAsset } from "@/lib/assets";
import { useEffect, useRef } from "react";

// Quietness is baked into the audio file, because iPhones ignore volume set from code.
const VOLUME = 1;
const FADE_MS = 900;

/**
 * Steady breathing inside the helmet. Fades in and out as you enter and leave the astronaut's POV,
 * and stops dead when `cut` is true, because the landing knocks the wind out of them.
 */
export function useBreathing(active: boolean, muted: boolean, cut: boolean) {
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audio.current) audio.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    if (active && !audio.current) {
      audio.current = new Audio(hostedAsset("/sounds/helmet-breathing.mp3"));
      audio.current.loop = true;
      audio.current.volume = 0;
      audio.current.muted = muted;
    }
    const sound = audio.current;
    if (!sound) return;
    if (cut) {
      sound.pause();
      sound.volume = 0;
      return;
    }
    if (active) sound.play().catch(() => {});

    const from = sound.volume;
    const to = active ? VOLUME : 0;
    const startedAt = performance.now();
    let frame = 0;
    const fade = () => {
      const k = Math.min(1, (performance.now() - startedAt) / FADE_MS);
      sound.volume = from + (to - from) * k;
      if (k < 1) frame = requestAnimationFrame(fade);
      else if (!active) sound.pause();
    };
    fade();
    return () => cancelAnimationFrame(frame);
    // muted is handled above; changing it shouldn't restart the fade
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, cut]);
}
