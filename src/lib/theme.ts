export type ThemeMode = "light" | "dark";
export type ThemePalette = "vanilla" | "custom";

export const MODE_KEY = "ragfolio-mode";
export const PALETTE_KEY = "ragfolio-palette";

/** Whether a custom theme file was present at build time (see next.config.ts). */
export const HAS_CUSTOM_THEME =
  process.env.NEXT_PUBLIC_HAS_CUSTOM_THEME === "true";

/**
 * No-FOUC init script, injected as the first thing in <body> so it runs before
 * paint. Sets data-mode (stored preference, else system) and data-palette
 * (stored preference, else vanilla; forced to vanilla when no custom theme
 * exists) on <html> so the tokens resolve on first render — no flash.
 */
export const themeInitScript = `(function(){try{
var d=document.documentElement;
var m=localStorage.getItem(${JSON.stringify(MODE_KEY)});
if(m!=='light'&&m!=='dark'){m=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
d.setAttribute('data-mode',m);
var hasCustom=${HAS_CUSTOM_THEME};
var p=localStorage.getItem(${JSON.stringify(PALETTE_KEY)});
if(p!=='custom'||!hasCustom){p='vanilla';}
d.setAttribute('data-palette',p);
}catch(e){}})();`;
