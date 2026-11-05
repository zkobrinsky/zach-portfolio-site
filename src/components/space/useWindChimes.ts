"use client";

import { useEffect, useRef } from "react";
import { createWindChimes } from "@/lib/audio/windChimes";


/** Always-on ambience. It begins on the visitor's first tap, click or key press, the earliest browsers allow it. */
export function useWindChimes(muted: boolean, insideHelmet: boolean) {
  const chimes = useRef<ReturnType<typeof createWindChimes> | null>(null);
  const isMuted = useRef(muted);
  const isInsideHelmet = useRef(insideHelmet);

  useEffect(() => {
    isMuted.current = muted;
    chimes.current?.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    isInsideHelmet.current = insideHelmet;
    chimes.current?.setInsideHelmet(insideHelmet);
  }, [insideHelmet]);

  useEffect(() => {
    // Every kind of press, on anything on the page, caught on its way down before any element can
    // stop it. It keeps trying on each one until audio is really running, then stops listening.
    const unlockEvents = ["pointerdown", "mousedown", "touchstart", "pointerup", "touchend", "click", "keydown"];
    const options = { capture: true, passive: true };
    const stopListening = () => unlockEvents.forEach((event) => window.removeEventListener(event, begin, options));
    const begin = () => {
      chimes.current ??= createWindChimes();
      chimes.current.setInsideHelmet(isInsideHelmet.current);
      chimes.current.start();
      if (isMuted.current) chimes.current.setMuted(true);
      if (chimes.current.running) stopListening();
    };
    unlockEvents.forEach((event) => window.addEventListener(event, begin, options));
    return () => {
      stopListening();
      chimes.current?.stop();
      chimes.current = null;
    };
  }, []);
}
