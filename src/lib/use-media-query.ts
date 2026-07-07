"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Track a CSS media query via useSyncExternalStore — the idiomatic way to read
 * an external store like matchMedia (no state-in-effect, hydration-safe). Used
 * for the responsive panel breakpoint, which is driven by corpus.config.ts's
 * minViewportWidth rather than a fixed Tailwind breakpoint. The server snapshot
 * is false, so callers must tolerate a false value during SSR/first paint.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}
