"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { MOONS } from "@/lib/space/moons";
import { debugParams, space } from "@/lib/space/state";
import { EyeOpening } from "./EyeOpening";
import { Header } from "./Header";
import { Joystick } from "./Joystick";
import { ShipGui } from "./ShipGui";
import { SpaceLoader } from "./SpaceLoader";
import { SilentContext } from "@/lib/audio/SilentContext";
import { useBreathing } from "./useBreathing";
import { useWindChimes } from "./useWindChimes";
import styles from "./SpaceExperience.module.css";

const SpaceCanvas = dynamic(() => import("./SpaceCanvas"), { ssr: false });

const MUTE_KEY = "muted";

/** How long the astronaut is out cold before the gasp. */
const BLACKOUT_MS = 1500;
/** Switching between pages: a quick dip to black. Stands in for the Star Trek teleport. */
const PAGE_SWITCH_MS = 220;
/** How long a page switch waits for the new page before uncovering the screen anyway. */
const SWITCH_GIVE_UP_MS = 4000;

/**
 * orbit: free to look around. travel: on the way to a moon. blackout: knocked out by the landing.
 * waking: eyes opening on the page. boarding: arrived at the ship, waiting for the URL to catch up.
 * landed: on the page. leaving: heading back to orbit.
 */
type Stage = "orbit" | "travel" | "boarding" | "blackout" | "waking" | "landed" | "leaving";

/** Which moon a URL belongs to, if any. */
const sectionFor = (pathname: string) => MOONS.find((moon) => `/${moon.id}` === pathname)?.id ?? null;

export function SpaceExperience({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const pageId = sectionFor(pathname);
  const [pov, setPov] = useState(false);
  const [showHud, setShowHud] = useState(false);
  const [resetCount, setResetCount] = useState(0);
  // arriving straight at a page's URL skips the trip: you're just on the page
  const [startedOnPage] = useState(pageId !== null);
  const [stage, setStage] = useState<Stage>(pageId ? "landed" : "orbit");
  const [destination, setDestination] = useState<string | null>(pageId);
  const [navHeight, setNavHeight] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const onReady = useCallback(() => setSceneReady(true), []);
  const inOrbit = stage === "orbit";
  const onPage = stage === "boarding" || stage === "blackout" || stage === "waking" || stage === "landed";
  const showPage = pageId !== null && (onPage || stage === "leaving");
  // a page aboard the ship keeps the 3D scene running behind its text
  const shipPage = MOONS.find((moon) => moon.id === pageId)?.ship === true;
  const thud = useRef<HTMLAudioElement | null>(null);
  const gasp = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  // what actually reaches the speakers; the visitor's own choice in `muted` is saved separately
  const silent = muted || tabHidden;

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // remember the visitor's choice between visits (storage can be blocked, so it's only a nice-to-have)
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- storage isn't available during prerender
      setMuted(localStorage.getItem(MUTE_KEY) === "true");
    } catch {}
  }, []);

  useEffect(() => {
    if (thud.current) thud.current.muted = silent;
    if (gasp.current) gasp.current.muted = silent;
  }, [silent]);

  useBreathing(pov || stage === "travel", silent, stage === "blackout");
  // chimes belong to space: faint inside the helmet, and off on a page
  useWindChimes(silent || showPage, pov || stage === "travel" || stage === "blackout");

  const toggleMuted = () => {
    setMuted(!muted);
    try {
      localStorage.setItem(MUTE_KEY, String(!muted));
    } catch {}
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "p" && inOrbit) setPov((value) => !value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inOrbit]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL isn't available during prerender
    setShowHud(debugParams().hud);
  }, []);

  const goTo = useCallback((id: string) => {
    thud.current ??= new Audio(`/sounds/impact-${debugParams().impactSound}.mp3`);
    gasp.current ??= new Audio("/sounds/gasp.mp3");
    thud.current.muted = gasp.current.muted = silent;
    setPov(false);
    setDestination(id);
    setStage("travel");
  }, [silent]);

  const goHome = useCallback(() => {
    setDestination(null);
    setStage("leaving");
  }, []);

  // the browser's back and forward buttons run the same trips
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- the URL is the outside system being synced to */
    if (stage === "boarding" && pageId) setStage("landed");
    else if (stage === "landed" && !pageId) goHome();
    else if (stage === "landed" && pageId) setDestination(pageId);
    else if (stage === "orbit" && pageId) goTo(pageId);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [pageId, stage, goHome, goTo]);

  // Switching pages fades through black. The fade back only starts once the new page has really arrived:
  // a slow route used to fade back early and flash the old page, like the ship interior behind About.
  const switchingTo = useRef<string | null>(null);
  const revealPage = useCallback(() => {
    const screen = space.blackout;
    switchingTo.current = null;
    if (!screen) return;
    screen.style.opacity = "0";
    setTimeout(() => {
      screen.style.transition = "";
    }, PAGE_SWITCH_MS);
  }, []);

  const switchPage = useCallback((id: string) => {
    const screen = space.blackout;
    if (!screen) return router.push(`/${id}`, { scroll: false });
    screen.style.transition = `opacity ${PAGE_SWITCH_MS}ms`;
    screen.style.opacity = "1";
    switchingTo.current = `/${id}`;
    setTimeout(() => {
      router.push(`/${id}`, { scroll: false });
      // never leave the screen black if the navigation goes nowhere
      setTimeout(() => {
        if (switchingTo.current === `/${id}`) revealPage();
      }, SWITCH_GIVE_UP_MS);
    }, PAGE_SWITCH_MS);
  }, [router, revealPage]);

  useEffect(() => {
    if (switchingTo.current !== pathname) return;
    // give the new page and the canvas a frame to draw before uncovering them
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(revealPage);
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, revealPage]);

  const onImpact = useCallback(() => {
    thud.current?.play().catch(() => {});
  }, []);
  const onCovered = useCallback((id: string | null) => {
    router.push(id ? `/${id}` : "/", { scroll: false });
    if (!id) return;
    if (MOONS.find((moon) => moon.id === id)?.ship) return setStage("boarding");
    setStage("blackout");
    setTimeout(() => {
      gasp.current?.play().catch(() => {});
      setStage("waking");
    }, BLACKOUT_MS);
  }, [router]);
  const onEyesOpen = useCallback(() => setStage("landed"), []);
  const onBackInOrbit = useCallback(() => setStage("orbit"), []);

  return (
    <>
      <div className={`${styles.canvas} ${showPage ? styles.overPage : ""} ${onPage && !shipPage ? styles.parked : ""}`}>
        <SpaceCanvas
          pov={pov || !inOrbit}
          steer={pov && inOrbit}
          resetCount={resetCount}
          destination={destination}
          startedOnPage={startedOnPage}
          paused={onPage && !shipPage}
          helmetOff={shipPage && showPage}
          onReady={onReady}
          onImpact={onImpact}
          onCovered={onCovered}
          onBackInOrbit={onBackInOrbit}
        />
      </div>
      <div ref={(element) => { space.visor = element; }} className={styles.visor} aria-hidden="true" />

      {showPage && <div className={styles.navBackground} style={{ height: navHeight, zIndex: shipPage ? 2 : undefined }} />}
      {/* always rendered, because the route's content has to exist even while it's hidden */}
      <article className={`${styles.page} ${shipPage ? styles.shipPage : ""}`} style={{ top: navHeight }} hidden={!showPage}>
        <SilentContext value={silent || !showPage}>{children}</SilentContext>
      </article>

      <Header
        pageId={pageId}
        inOrbit={inOrbit}
        landed={stage === "landed"}
        muted={muted}
        onToggleMute={toggleMuted}
        onGoTo={goTo}
        onSwitchPage={switchPage}
        onGoHome={goHome}
        onHeightChange={setNavHeight}
      />

      <div ref={(element) => { space.blackout = element; }} className={styles.blackout} aria-hidden="true" />
      {stage === "waking" && <EyeOpening onOpen={onEyesOpen} />}
      {/* plain pages are ordinary web pages, so they don't wait for the 3D scene */}
      <SpaceLoader done={sceneReady || (onPage && !shipPage)} />

      {showHud && <div ref={(element) => { space.hud = element; }} className={styles.hud} />}
      {stage === "landed" && (
        <div className={styles.controls}>
          <button type="button" className={styles.button} onClick={goHome}>
            Back to orbit
          </button>
        </div>
      )}
      {process.env.NODE_ENV === "development" && <ShipGui />}
      {inOrbit && pov && (
        <>
          <Joystick label="Move" side="left" />
          <Joystick label="Look" side="right" />
        </>
      )}
      {inOrbit && pov && <p className={styles.keysHint}>Mouse to look · W A S D to fly · Esc for cursor</p>}
      {inOrbit && (
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              setPov(false);
              setResetCount((count) => count + 1);
            }}
          >
            Reset view
          </button>
          <button type="button" className={styles.button} onClick={() => setPov((value) => !value)}>
            {pov ? "Back to orbit" : "Astronaut POV"}
          </button>
        </div>
      )}
    </>
  );
}
