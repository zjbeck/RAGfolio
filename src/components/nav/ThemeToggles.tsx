"use client";

import { useSyncExternalStore } from "react";
import { copy } from "@/copy";
import {
  HAS_CUSTOM_THEME,
  MODE_KEY,
  PALETTE_KEY,
  type ThemeMode,
  type ThemePalette,
} from "@/lib/theme";

/** Read a <html> attribute reactively (updates when the attribute changes). */
function useHtmlAttr(name: string, fallback: string): string {
  return useSyncExternalStore(
    (onChange) => {
      const observer = new MutationObserver(onChange);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: [name],
      });
      return () => observer.disconnect();
    },
    () => document.documentElement.getAttribute(name) ?? fallback,
    () => fallback
  );
}

/**
 * Two theme toggles: light/dark, and vanilla/custom palette. They read the
 * data-* attributes the no-FOUC script set on <html>; toggling mutates the
 * attribute (which the reactive read reflects) and persists to localStorage.
 * The palette toggle renders disabled when no custom theme file exists — the
 * capability is advertised, never broken.
 */
export function ThemeToggles() {
  const mode = (useHtmlAttr("data-mode", "light") === "dark"
    ? "dark"
    : "light") as ThemeMode;
  const palette = (useHtmlAttr("data-palette", "vanilla") === "custom"
    ? "custom"
    : "vanilla") as ThemePalette;

  function toggleMode() {
    const next: ThemeMode = mode === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-mode", next);
    localStorage.setItem(MODE_KEY, next);
  }

  function togglePalette() {
    const next: ThemePalette = palette === "custom" ? "vanilla" : "custom";
    document.documentElement.setAttribute("data-palette", next);
    localStorage.setItem(PALETTE_KEY, next);
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={toggleMode}
        aria-label={copy.nav.themeMode}
        title={copy.nav.themeMode}
        className="rounded-[var(--radius-sm)] p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
      >
        {mode === "dark" ? <MoonIcon /> : <SunIcon />}
      </button>
      <button
        onClick={togglePalette}
        disabled={!HAS_CUSTOM_THEME}
        aria-label={copy.nav.themePalette}
        title={HAS_CUSTOM_THEME ? copy.nav.themePalette : copy.nav.themePaletteUnavailable}
        aria-pressed={palette === "custom"}
        className={`rounded-[var(--radius-sm)] p-1.5 ${
          palette === "custom" ? "text-accent" : "text-muted"
        } enabled:hover:bg-surface-2 enabled:hover:text-ink disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <PaletteIcon />
      </button>
    </div>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="13.5" cy="6.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="10.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="6.5" cy="12.5" r="1.3" fill="currentColor" stroke="none" />
      <path d="M12 2a10 10 0 0 0 0 20 2.5 2.5 0 0 0 2-4 2.5 2.5 0 0 1 2-4h1a3 3 0 0 0 3-3 9 9 0 0 0-8-9Z" strokeLinejoin="round" />
    </svg>
  );
}
