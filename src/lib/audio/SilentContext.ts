"use client";

import { createContext } from "react";

/** True when a page's own sound should be quiet: muted in the header, tab hidden, or page not showing. */
export const SilentContext = createContext(false);
