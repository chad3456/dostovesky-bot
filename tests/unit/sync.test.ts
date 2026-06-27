import { describe, it, expect } from "vitest";
import { generateSyncCode, normalizeSyncCode } from "@/lib/sync";

describe("generateSyncCode", () => {
  it("produces a grouped 12-char code from the safe alphabet", () => {
    const code = generateSyncCode();
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    // No ambiguous characters.
    expect(code).not.toMatch(/[01OI]/);
  });

  it("is random across calls", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateSyncCode()));
    expect(codes.size).toBe(50);
  });
});

describe("normalizeSyncCode", () => {
  it("accepts lowercase, spaces and missing dashes", () => {
    const code = generateSyncCode();
    const messy = code.toLowerCase().replace(/-/g, " ");
    expect(normalizeSyncCode(messy)).toBe(code);
  });

  it("rejects codes of the wrong length", () => {
    expect(normalizeSyncCode("ABC")).toBe("");
    expect(normalizeSyncCode("")).toBe("");
  });

  it("strips invalid characters when counting", () => {
    // Contains an ambiguous '0' and 'I' which are not in the alphabet.
    expect(normalizeSyncCode("ABCD-EFGH-JKL0")).toBe("");
  });
});
