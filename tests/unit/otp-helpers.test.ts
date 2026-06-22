import { describe, it, expect } from "vitest";
import { normalizeEmail, isValidEmail } from "@/lib/otp";
import {
  requestOtpSchema,
  verifyOtpSchema,
  onboardingSchema,
} from "@/lib/validation";

describe("email helpers", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizeEmail("  Reader@Example.COM ")).toBe("reader@example.com");
  });

  it("validates email shape", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@c.com")).toBe(false);
  });
});

describe("auth/onboarding schemas", () => {
  it("requestOtpSchema requires a valid email", () => {
    expect(() => requestOtpSchema.parse({ email: "x" })).toThrow();
    expect(requestOtpSchema.parse({ email: "a@b.co" }).email).toBe("a@b.co");
  });

  it("verifyOtpSchema enforces a 6-digit code", () => {
    expect(() =>
      verifyOtpSchema.parse({ email: "a@b.co", code: "12" }),
    ).toThrow();
    expect(() =>
      verifyOtpSchema.parse({ email: "a@b.co", code: "abcdef" }),
    ).toThrow();
    expect(
      verifyOtpSchema.parse({ email: "a@b.co", code: "123456" }).code,
    ).toBe("123456");
  });

  it("onboardingSchema requires a name and bounds font size", () => {
    expect(() => onboardingSchema.parse({ name: "" })).toThrow();
    expect(() => onboardingSchema.parse({ name: "A", fontSize: 99 })).toThrow();
    const r = onboardingSchema.parse({ name: "Ada", theme: "sepia", fontSize: 22 });
    expect(r.name).toBe("Ada");
    expect(r.theme).toBe("sepia");
  });
});
