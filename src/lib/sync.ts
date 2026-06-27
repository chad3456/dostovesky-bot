import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// Human-friendly code: 12 chars from an unambiguous alphabet (no 0/O/1/I),
// formatted XXXX-XXXX-XXXX. ~60 bits of entropy — a bearer credential, like a
// secret share link.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateSyncCode(): string {
  const chars: string[] = [];
  for (let i = 0; i < 12; i++) {
    chars.push(ALPHABET[crypto.randomInt(0, ALPHABET.length)]);
  }
  const s = chars.join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

/** Normalize user input: uppercase, strip everything but the alphabet, regroup. */
export function normalizeSyncCode(input: string): string {
  const cleaned = (input || "")
    .toUpperCase()
    .split("")
    .filter((c) => ALPHABET.includes(c))
    .join("");
  if (cleaned.length !== 12) return "";
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8, 12)}`;
}

const DEFAULT_PREFS = {
  theme: "light",
  fontFamily: "serif",
  fontSize: 18,
  lineHeight: 1.6,
  margin: 24,
  justify: true,
  flow: "paginated",
};

/**
 * Create a brand-new anonymous library with its own Sync Code. The account is
 * pre-onboarded (no email/Google needed) so the user lands straight in their
 * library. Returns the plaintext code so it can be shown once and used to sign
 * in on other devices.
 */
export async function createSyncLibrary(): Promise<{
  userId: string;
  code: string;
}> {
  // Retry on the (astronomically unlikely) code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateSyncCode();
    const existing = await prisma.user.findUnique({ where: { syncCode: code } });
    if (existing) continue;
    const user = await prisma.user.create({
      data: {
        name: "My Library",
        syncCode: code,
        onboardedAt: new Date(),
        preferences: { create: { ...DEFAULT_PREFS } },
      },
      select: { id: true },
    });
    return { userId: user.id, code };
  }
  throw new Error("Could not allocate a sync code, please try again.");
}

/** Find the library that owns a given Sync Code, or null. */
export async function findBySyncCode(rawCode: string) {
  const code = normalizeSyncCode(rawCode);
  if (!code) return null;
  return prisma.user.findUnique({
    where: { syncCode: code },
    select: { id: true, name: true },
  });
}
