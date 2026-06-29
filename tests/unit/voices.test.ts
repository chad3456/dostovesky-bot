import { describe, it, expect } from "vitest";
import {
  isLikelyFemale,
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
