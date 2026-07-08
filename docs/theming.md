# Theming

Every color in RAGfolio flows through CSS-variable tokens. There are two
palettes — **vanilla** (shipped) and an optional **custom** — each in **light**
and **dark**, selected by `data-mode` and `data-palette` attributes on `<html>`.
Layout and structure are not themeable; only color is.

## Tokens

The vanilla palettes live in [`src/app/globals.css`](../src/app/globals.css):
`:root` is vanilla light, `:root[data-mode="dark"]` is vanilla dark. Components
reference the tokens (`--canvas`, `--surface`, `--ink`, `--muted`, `--line`,
`--accent`, `--dim-ink`, …) via Tailwind utilities like `bg-canvas` and
`text-ink` — never raw hex.

Dimmed forest nodes use dedicated `--dim-*` tokens rather than opacity, because
a 30%-opacity node would fail AA contrast. Keep every token pair AA-legible if
you edit them.

## Adding a custom palette

Create [`src/styles/theme.custom.css`](../src/styles/theme.custom.css) (the
template ships one — the "Verdant" green palette — as an example) and override
the same token names, scoped to the custom palette:

```css
:root[data-palette="custom"] {
  --canvas: #f5f8f3;
  --accent: #2e7d46;
  /* …the rest of the tokens… */
}
:root[data-palette="custom"][data-mode="dark"] {
  --canvas: #0c120a;
  --accent: #56b06f;
  /* …the rest… */
}
```

That's it. A build-time step ([`scripts/detect-theme.ts`](../scripts/detect-theme.ts),
run in `predev`/`prebuild`) notices the file and wires it in; `next.config.ts`
sets `NEXT_PUBLIC_HAS_CUSTOM_THEME` so the palette toggle appears in the nav.

## Graceful degradation

The custom palette is genuinely optional. If `theme.custom.css` doesn't exist:

- The build still succeeds — the detection step generates an empty shim, so
  there's never a dangling import to a missing file.
- The vanilla/custom toggle renders **disabled**, with a tooltip explaining how
  to enable it. The capability is advertised, never broken.

To remove custom theming, delete `theme.custom.css`; nothing else to touch.

## Preferences

Both toggles live at the right of the nav. Choices persist in `localStorage`;
a small inline script applies them before first paint (reading the stored
preference, or the system color scheme for light/dark on first visit), so there
is no flash of the wrong theme.

## Contrast

All four palettes meet WCAG AA, including the dimmed forest nodes — the case
most likely to slip. If you change a palette, re-check the dimmed-node text
against its surface (target ≥ 4.5:1) and the accent against the canvas.
