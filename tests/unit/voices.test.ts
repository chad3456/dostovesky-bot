import { describe, it, expect } from "vitest";
import {
  isLikelyFemale,
  isLikelyMale,
  pickHostVoices,
  pickDefaultVoice,
  sortVoicesForPicker,
  type VoiceLike,
} from "@/lib/voices";

const v = (name: string, lang = "en-US"): VoiceLike => ({
  name,
  lang,
  voiceURI: `${name}-${lang}`,
});

describe("isLikelyFemale", () => {
  it("detects common female voice names", () => {
    expect(isLikelyFemale(v("Samantha"))).toBe(true);
    expect(isLikelyFemale(v("Microsoft Zira Desktop"))).toBe(true);
    expect(isLikelyFemale(v("Google UK English Female"))).toBe(true);
  });
  it("does not flag obviously male/neutral voices", () => {
    expect(isLikelyFemale(v("Daniel"))).toBe(false);
    expect(isLikelyFemale(v("Microsoft David"))).toBe(false);
  });
});

describe("pickDefaultVoice", () => {
  it("prefers a premium female voice in the right language", () => {
    const voices = [v("Daniel", "en-GB"), v("Ava", "en-US"), v("Thomas", "fr-FR")];
    expect(pickDefaultVoice(voices, "en")).toBe("Ava-en-US");
  });

  it("falls back to any female voice", () => {
    const voices = [v("Daniel"), v("Karen", "en-AU")];
    expect(pickDefaultVoice(voices, "en")).toBe("Karen-en-AU");
  });

  it("falls back to the first voice when no female exists", () => {
    const voices = [v("Daniel"), v("Thomas")];
    expect(pickDefaultVoice(voices, "en")).toBe("Daniel-en-US");
  });

  it("returns null with no voices", () => {
    expect(pickDefaultVoice([], "en")).toBeNull();
  });
});

describe("sortVoicesForPicker", () => {
  it("orders matching-language and female voices first", () => {
    const voices = [
      v("Thomas", "fr-FR"),
      v("Daniel", "en-GB"),
      v("Samantha", "en-US"),
    ];
    const sorted = sortVoicesForPicker(voices, "en").map((x) => x.name);
    expect(sorted[0]).toBe("Samantha"); // english + female first
    expect(sorted[sorted.length - 1]).toBe("Thomas"); // non-english last
  });
});

describe("pickHostVoices", () => {
  it("pairs a female host A with a male host B", () => {
    const voices = [v("Samantha"), v("Daniel"), v("Thomas", "fr-FR")];
    const { a, b } = pickHostVoices(voices, "en");
    expect(a).toBe("Samantha-en-US");
    expect(b).toBe("Daniel-en-US");
  });

  it("falls back to any other distinct voice when no male voice exists", () => {
    const voices = [v("Samantha"), v("Karen", "en-AU")];
    const { a, b } = pickHostVoices(voices, "en");
    expect(a).toBe("Samantha-en-US");
    expect(b).toBe("Karen-en-AU");
    expect(a).not.toBe(b);
  });

  it("reuses the single available voice for both hosts", () => {
    const { a, b } = pickHostVoices([v("Samantha")], "en");
    expect(a).toBe("Samantha-en-US");
    expect(b).toBe("Samantha-en-US");
  });

  it("returns nulls when the device has no voices", () => {
    expect(pickHostVoices([], "en")).toEqual({ a: null, b: null });
  });
});

describe("isLikelyMale", () => {
  it("detects common male voice names and never double-counts female ones", () => {
    expect(isLikelyMale(v("Daniel"))).toBe(true);
    expect(isLikelyMale(v("Microsoft David"))).toBe(true);
    expect(isLikelyMale(v("Samantha"))).toBe(false);
  });
});
