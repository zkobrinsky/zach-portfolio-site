"use client";

import Link from "next/link";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { NAV, type MoonSpec } from "@/lib/space/moons";
import styles from "./SpaceExperience.module.css";

/** Let the browser handle cmd/ctrl/shift-clicks, so links can still open in a new tab. */
const opensNewTab = (event: MouseEvent) => event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0;

type Props = {
  /** The page being shown, if any. */
  pageId: string | null;
  inOrbit: boolean;
  landed: boolean;
  muted: boolean;
  onToggleMute: () => void;
  /** Start a trip from orbit to a page. */
  onGoTo: (id: string) => void;
  /** Jump from one page straight to another. */
  onSwitchPage: (id: string) => void;
  onGoHome: () => void;
  /** Pages sit below the bar, so they need to know how tall it is. */
  onHeightChange: (height: number) => void;
};

/** The name, the main nav with its dropdowns, the phone menu, and the sound button. */
export function Header({ pageId, inOrbit, landed, muted, onToggleMute, onGoTo, onSwitchPage, onGoHome, onHeightChange }: Props) {
  const header = useRef<HTMLElement>(null);
  const nav = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  /** After a click, a dropdown stays shut until the mouse leaves, or hovering would hold it open. */
  const [hoverClosed, setHoverClosed] = useState(false);
  const navEnabled = inOrbit || landed;

  const closeMenus = () => {
    setMenuOpen(false);
    setOpenDropdown(null);
    setHoverClosed(true);
  };

  useEffect(() => {
    const element = header.current;
    if (!element) return;
    const observer = new ResizeObserver(() => onHeightChange(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, [onHeightChange]);

  // a dropdown closes on Escape, or when the press or the keyboard focus goes somewhere else
  useEffect(() => {
    if (!openDropdown) return;
    const onPress = (event: PointerEvent) => {
      if (!nav.current?.contains(event.target as Node)) setOpenDropdown(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenDropdown(null);
    };
    document.addEventListener("pointerdown", onPress);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPress);
      document.removeEventListener("keydown", onKey);
    };
  }, [openDropdown]);

  const pageLink = (moon: MoonSpec) => (
    <Link
      key={moon.id}
      href={`/${moon.id}`}
      aria-disabled={!navEnabled}
      aria-current={pageId === moon.id ? "page" : undefined}
      onClick={(event) => {
        if (opensNewTab(event)) return;
        event.preventDefault();
        closeMenus();
        if (inOrbit) onGoTo(moon.id);
        else if (landed && moon.id !== pageId) onSwitchPage(moon.id);
      }}
    >
      {moon.label}
    </Link>
  );

  return (
    <header ref={header} className={styles.header}>
      <h1 className={styles.name}>
        <Link
          href="/"
          onClick={(event) => {
            if (opensNewTab(event)) return;
            event.preventDefault();
            closeMenus();
            if (landed) onGoHome();
          }}
        >
          Zach Kobrinsky
          <span className={styles.jobTitle}>Senior Frontend Engineer</span>
        </Link>
      </h1>
      <button
        type="button"
        className={styles.menuButton}
        aria-expanded={menuOpen}
        aria-controls="main-nav"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        {menuOpen ? "Close" : "Menu"}
      </button>
      <nav ref={nav} id="main-nav" className={`${styles.nav} ${menuOpen ? styles.navOpen : ""}`} aria-label="Main">
        {NAV.map((item) =>
          "items" in item ? (
            <div
              key={item.label}
              className={styles.group}
              data-open={openDropdown === item.label}
              data-hover-closed={hoverClosed}
              onPointerLeave={() => setHoverClosed(false)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setOpenDropdown(null);
              }}
            >
              <button
                type="button"
                aria-expanded={openDropdown === item.label}
                aria-disabled={!navEnabled}
                data-current={item.items.some((moon) => moon.id === pageId)}
                onClick={() => {
                  if (navEnabled) setOpenDropdown(openDropdown === item.label ? null : item.label);
                }}
              >
                {item.label}
              </button>
              <div className={styles.dropdown}>{item.items.map(pageLink)}</div>
            </div>
          ) : (
            pageLink(item)
          ),
        )}
      </nav>
      <button type="button" className={styles.mute} aria-pressed={muted} onClick={onToggleMute}>
        {muted ? "Sound off" : "Sound on"}
      </button>
    </header>
  );
}
