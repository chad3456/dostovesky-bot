import { describe, it, expect } from "vitest";
import {
  progressSchema,
  createHighlightSchema,
  preferencesSchema,
} from "@/lib/validation";

describe("progressSchema", () => {
  it("accepts a valid position", () => {
    const r = progressSchema.parse({ cfi: "epubcfi(/6/4)", percentage: 0.5 });
    expect(r.percentage).toBe(0.5);
  });
  it("rejects out-of-range percentages", () => {
    expect(() => progressSchema.parse({ percentage: 1.5 })).toThrow();
    expect(() => progressSchema.parse({ percentage: -0.1 })).toThrow();
  });
});

describe("createHighlightSchema", () => {
  it("defaults color to yellow", () => {
    const r = createHighlightSchema.parse({
      cfiRange: "epubcfi(/6/4,/2,/4)",
      text: "hello",
    });
    expect(r.color).toBe("yellow");
  });
  it("rejects unknown colors", () => {
    expect(() =>
      createHighlightSchema.parse({
        cfiRange: "x",
        text: "y",
        color: "rainbow",
      }),
    ).toThrow();
  });
  it("rejects empty text", () => {
    expect(() =>
      createHighlightSchema.parse({ cfiRange: "x", text: "" }),
    ).toThrow();
  });
});

describe("preferencesSchema", () => {
  it("accepts partial updates", () => {
    const r = preferencesSchema.parse({ fontSize: 24 });
    expect(r.fontSize).toBe(24);
  });
  it("enforces font size bounds", () => {
    expect(() => preferencesSchema.parse({ fontSize: 9 })).toThrow();
    expect(() => preferencesSchema.parse({ fontSize: 99 })).toThrow();
  });
  it("rejects unknown themes", () => {
    expect(() => preferencesSchema.parse({ theme: "neon" })).toThrow();
  });

  it("accepts the handwritten font family", () => {
    expect(
      preferencesSchema.parse({ fontFamily: "handwritten" }).fontFamily,
    ).toBe("handwritten");
  });
});
