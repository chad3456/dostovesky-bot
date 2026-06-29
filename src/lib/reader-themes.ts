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
  vintage: {
    id: "vintage",
    label: "Vintage",
    // Aged parchment + sepia ink; a layered paper texture is added in
    // buildEpubThemeRules so old books really feel old.
    background: "#e8dcc0",
    color: "#3b2f23",
    link: "#7a5230",
    chrome: "bg-[#e8dcc0] text-[#3b2f23] border-[#c9b28a]",
  },
};

export const FONT_STACKS: Record<string, string> = {
  serif: 'Georgia, Cambria, "Times New Roman", serif',
  sans: '-apple-system, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  dyslexic:
    '"OpenDyslexic", "Comic Sans MS", "Trebuchet MS", Verdana, sans-serif',
  // A genuine 17th/18th-century printed typeface (revived by Igino Marini).
  oldstyle: '"IM Fell English", "IM Fell DW Pica", Georgia, "Times New Roman", serif',
  // 1700s-style handwritten cursive.
  cursive: '"Tangerine", "Pinyon Script", "Snell Roundhand", cursive',
};

// Fonts that read small and need extra size/leading to stay legible.
export const FONT_SCALE: Record<string, number> = {
  cursive: 1.6,
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
// Layered CSS that makes the parchment look aged (no image asset needed).
const PARCHMENT_BG =
  "#e8dcc0 " +
  "radial-gradient(circle at 50% -10%, rgba(0,0,0,0.05), transparent 55%), " +
  "radial-gradient(circle at 0% 100%, rgba(120,82,48,0.12), transparent 45%), " +
  "radial-gradient(circle at 100% 100%, rgba(120,82,48,0.12), transparent 45%), " +
  "radial-gradient(circle at 50% 50%, rgba(232,220,192,0) 60%, rgba(90,60,30,0.10) 100%)";

export function buildEpubThemeRules(opts: {
  themeId: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  justify: boolean;
}): Record<string, Record<string, string>> {
  const theme = READER_THEMES[opts.themeId] ?? READER_THEMES.light;
  const font = FONT_STACKS[opts.fontFamily] ?? FONT_STACKS.serif;
  const isVintage = theme.id === "vintage";
  const size = Math.round(opts.fontSize * (FONT_SCALE[opts.fontFamily] ?? 1));

  const rules: Record<string, Record<string, string>> = {
    body: {
      background: `${isVintage ? PARCHMENT_BG : theme.background} !important`,
      color: `${theme.color} !important`,
      "font-family": `${font} !important`,
      "font-size": `${size}px !important`,
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

  if (isVintage) {
    // Decorative drop-cap on the opening paragraph of each page.
    rules["p:first-of-type::first-letter"] = {
      "font-size": "3.1em !important",
      "line-height": "0.8 !important",
      float: "left !important",
      "padding-right": "0.08em !important",
      color: "#6b4423 !important",
      "font-family": `${FONT_STACKS.oldstyle} !important`,
    };
  }

  return rules;
}
