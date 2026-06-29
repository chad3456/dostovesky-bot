import { z } from "zod";

export const progressSchema = z.object({
  cfi: z.string().max(4000).nullable().optional(),
  percentage: z.number().min(0).max(1),
  label: z.string().max(500).nullable().optional(),
});

export const HIGHLIGHT_COLORS = [
  "yellow",
  "green",
  "blue",
  "pink",
  "orange",
] as const;

export const createHighlightSchema = z.object({
  cfiRange: z.string().min(1).max(4000),
  text: z.string().min(1).max(20000),
  color: z.enum(HIGHLIGHT_COLORS).default("yellow"),
  note: z.string().max(10000).nullable().optional(),
  chapter: z.string().max(500).nullable().optional(),
});

export const updateHighlightSchema = z.object({
  color: z.enum(HIGHLIGHT_COLORS).optional(),
  note: z.string().max(10000).nullable().optional(),
});

export const THEMES = [
  "light",
  "sepia",
  "dark",
  "night",
  "high-contrast",
  "vintage",
] as const;
export const FONT_FAMILIES = [
  "serif",
  "sans",
  "dyslexic",
  "oldstyle",
  "cursive",
] as const;
export const FLOWS = ["paginated", "scrolled"] as const;

export const preferencesSchema = z.object({
  theme: z.enum(THEMES).optional(),
  fontFamily: z.enum(FONT_FAMILIES).optional(),
  fontSize: z.number().int().min(12).max(48).optional(),
  lineHeight: z.number().min(1).max(3).optional(),
  margin: z.number().int().min(0).max(120).optional(),
  justify: z.boolean().optional(),
  flow: z.enum(FLOWS).optional(),
});

export const shareSchema = z.object({
  expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
});

export const requestOtpSchema = z.object({
  email: z.string().email().max(320),
});

export const verifyOtpSchema = z.object({
  email: z.string().email().max(320),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const onboardingSchema = z.object({
  name: z.string().min(1).max(80),
  theme: z.enum(THEMES).optional(),
  fontFamily: z.enum(FONT_FAMILIES).optional(),
  fontSize: z.number().int().min(12).max(48).optional(),
});

export type ProgressInput = z.infer<typeof progressSchema>;
export type CreateHighlightInput = z.infer<typeof createHighlightSchema>;
export type PreferencesInput = z.infer<typeof preferencesSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
