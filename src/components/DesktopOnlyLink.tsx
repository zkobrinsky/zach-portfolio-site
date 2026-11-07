"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// touch devices get complex.com's mobile site, which ignores the democampaign takeovers
const TOUCH_QUERY = "(hover: none) and (pointer: coarse)";
const MESSAGE = "Desktop experience only (sorry)";

export default function DesktopOnlyLink({
  href,
  className,
  tooltipClassName,
  children,
}: {
  href: string;
  className?: string;
  tooltipClassName?: string;
  children: ReactNode;
}) {
  const [touch, setTouch] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const query = window.matchMedia(TOUCH_QUERY);
    const update = () => setTouch(query.matches);
    update();
    query.addEventListener("change", update);
    return () => {
      query.removeEventListener("change", update);
      clearTimeout(hideTimer.current);
    };
  }, []);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-disabled={touch || undefined}
      title={touch ? MESSAGE : undefined}
      onClick={(event) => {
        if (!window.matchMedia(TOUCH_QUERY).matches) return;
        event.preventDefault();
        setShowTip(true);
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setShowTip(false), 2500);
      }}
    >
      {children}
      {touch && showTip && (
        <span className={tooltipClassName} role="status">
          {MESSAGE}
        </span>
      )}
    </a>
  );
}
