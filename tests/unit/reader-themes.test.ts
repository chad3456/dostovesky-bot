import { describe, it, expect } from "vitest";
import {
  buildEpubThemeRules,
  READER_THEMES,
  FONT_STACKS,
  HIGHLIGHT_FILL,
} from "@/lib/reader-themes";

describe("buildEpubThemeRules", () => {
  it("applies the selected theme colors to the body", () => {
    const rules = buildEpubThemeRules({
      themeId: "dark",
      fontFamily: "serif",
      fontSize: 20,
      lineHeight: 1.8,
      justify: true,
    });
    expect(rules.body.background).toContain(READER_THEMES.dark.background);
    expect(rules.body.color).toContain(READER_THEMES.dark.color);
    expect(rules.body["font-size"]).toContain("20px");
    expect(rules.body["line-height"]).toContain("1.8");
    expect(rules.body["text-align"]).toContain("justify");
  });

  it("uses left alignment when justify is off", () => {
    const rules = buildEpubThemeRules({
      themeId: "light",
      fontFamily: "sans",
      fontSize: 16,
      lineHeight: 1.5,
      justify: false,
    });
    expect(rules.body["text-align"]).toContain("left");
    expect(rules.body["font-family"]).toContain(FONT_STACKS.sans.split(",")[0]);
  });

  it("falls back to the light theme for unknown ids", () => {
    const rules = buildEpubThemeRules({
      themeId: "does-not-exist",
      fontFamily: "mystery",
      fontSize: 18,
      lineHeight: 1.6,
      justify: true,
    });
    expect(rules.body.background).toContain(READER_THEMES.light.background);
    expect(rules.body["font-family"]).toContain(FONT_STACKS.serif.split(",")[0]);
  });

  it("defines a fill color for every highlight color", () => {
    for (const c of ["yellow", "green", "blue", "pink", "orange"]) {
      expect(HIGHLIGHT_FILL[c]).toMatch(/^#/);
    }
  });

  it("gives the vintage theme an aged-paper background and a drop-cap", () => {
    const rules = buildEpubThemeRules({
      themeId: "vintage",
      fontFamily: "oldstyle",
      fontSize: 18,
      lineHeight: 1.6,
      justify: true,
    });
    // Layered gradients (parchment texture), not a flat color.
    expect(rules.body.background).toContain("gradient");
    expect(rules.body["font-family"]).toContain("IM Fell English");
    expect(rules["p:first-of-type::first-letter"]).toBeTruthy();
  });

  it("scales up small cursive type for legibility", () => {
    const rules = buildEpubThemeRules({
      themeId: "vintage",
      fontFamily: "cursive",
      fontSize: 20,
      lineHeight: 1.6,
      justify: false,
    });
    // 20 * 1.6 scale = 32px
    expect(rules.body["font-size"]).toContain("32px");
    expect(rules.body["font-family"]).toContain("Tangerine");
  });
});
