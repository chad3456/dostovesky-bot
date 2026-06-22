// Visual themes applied to the epub.js rendition AND the surrounding chrome.
// Kept framework-agnostic so it can be unit-tested without the DOM.

export interface ReaderTheme {
  id: string;
  label: string;
  // Page (book content) colors
  background: string;
  color: string;
  link: string;
  // Selection/highlight base
  // Chrome (toolbar/panels) tailwind-ish classes
  chrome: string;
}

export const READER_THEMES: Record<string, ReaderTheme> = {
  light: {
    id: "light",
    label: "Light",
    background: "#ffffff",
    color: "#1f2937",
    link: "#4f46e5",
    chrome: "bg-white text-slate-800 border-slate-200",
  },
  sepia: {
    id: "sepia",
    label: "Sepia",
    background: "#f4ecd8",
    color: "#5b4636",
    link: "#7c5e3c",
    chrome: "bg-[#f4ecd8] text-[#5b4636] border-[#e2d4b7]",
  },
  dark: {
    id: "dark",
    label: "Dark",
    background: "#1e293b",
    color: "#e2e8f0",
    link: "#93c5fd",
    chrome: "bg-slate-800 text-slate-100 border-slate-700",
  },
  night: {
    id: "night",
    label: "Night",
    background: "#000000",
    color: "#c9c9c9",
    link: "#7dd3fc",
    chrome: "bg-black text-slate-200 border-slate-800",
  },
  "high-contrast": {
    id: "high-contrast",
    label: "High Contrast",
    background: "#000000",
    color: "#ffffff",
    link: "#ffff00",
    chrome: "bg-black text-white border-white",
  },
};

export const FONT_STACKS: Record<string, string> = {
  serif: 'Georgia, Cambria, "Times New Roman", serif',
  sans: '-apple-system, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  dyslexic:
    '"OpenDyslexic", "Comic Sans MS", "Trebuchet MS", Verdana, sans-serif',
};

export const HIGHLIGHT_FILL: Record<string, string> = {
  yellow: "#fde047",
  green: "#86efac",
  blue: "#93c5fd",
  pink: "#f9a8d4",
  orange: "#fdba74",
};

/**
 * Build the epub.js theme rules object for a given set of preferences.
 * Returned shape matches what `rendition.themes.register(name, rules)` expects.
 */
export function buildEpubThemeRules(opts: {
  themeId: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  justify: boolean;
}): Record<string, Record<string, string>> {
  const theme = READER_THEMES[opts.themeId] ?? READER_THEMES.light;
  const font = FONT_STACKS[opts.fontFamily] ?? FONT_STACKS.serif;
  return {
    body: {
      background: `${theme.background} !important`,
      color: `${theme.color} !important`,
      "font-family": `${font} !important`,
      "font-size": `${opts.fontSize}px !important`,
      "line-height": `${opts.lineHeight} !important`,
      "text-align": opts.justify ? "justify !important" : "left !important",
      padding: "0 !important",
    },
    "p, li, div, span": {
      "font-family": `${font} !important`,
      "line-height": `${opts.lineHeight} !important`,
      color: `${theme.color} !important`,
    },
    a: { color: `${theme.link} !important` },
    "h1, h2, h3, h4, h5, h6": { color: `${theme.color} !important` },
    img: { "max-width": "100% !important", height: "auto !important" },
    "::selection": { background: "rgba(99,102,241,0.35)" },
  };
}
