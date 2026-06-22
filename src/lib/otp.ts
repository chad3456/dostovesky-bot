import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
const RESEND_WINDOW_MS = 30 * 1000; // min seconds between sends per email
const MAX_PER_HOUR = 8;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashCode(email: string, code: string): string {
  const secret = process.env.AUTH_SECRET || "lumen-otp-pepper";
  return crypto
    .createHmac("sha256", secret)
    .update(`${email}:${code}`)
    .digest("hex");
}

function generateCode(): string {
  // 6-digit, zero-padded, cryptographically random.
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export class OtpRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OtpRateLimitError";
  }
}

/**
 * Create and persist a one-time passcode for an email. Returns the plaintext
 * code so the caller can deliver it (by email in production). Throttled per
 * email to resist abuse.
 */
export async function createEmailOtp(rawEmail: string): Promise<{ code: string }> {
  const email = normalizeEmail(rawEmail);

  const now = Date.now();
  const recent = await prisma.emailOtp.findMany({
    where: { email, createdAt: { gt: new Date(now - 60 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
  });

  if (recent.length >= MAX_PER_HOUR) {
    throw new OtpRateLimitError("Too many codes requested. Please try later.");
  }
  if (recent[0] && now - recent[0].createdAt.getTime() < RESEND_WINDOW_MS) {
    throw new OtpRateLimitError("Please wait a moment before requesting another code.");
  }

  // Invalidate any outstanding codes for this email.
  await prisma.emailOtp.updateMany({
    where: { email, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const code = generateCode();
  await prisma.emailOtp.create({
    data: {
      email,
      codeHash: hashCode(email, code),
      expiresAt: new Date(now + CODE_TTL_MS),
    },
  });

  return { code };
}

export interface VerifiedUser {
  id: string;
  email: string;
  name: string | null;
}

/**
 * Verify a submitted code. On success the matching OTP is consumed and the
 * user is created if they don't yet exist (sign-up + sign-in unified).
 * Returns null on any failure (expired, wrong, too many attempts).
 */
export async function verifyEmailOtp(
  rawEmail: string,
  code: string,
): Promise<VerifiedUser | null> {
  const email = normalizeEmail(rawEmail);
  const cleanCode = (code || "").trim();
  if (!/^\d{6}$/.test(cleanCode)) return null;

  const otp = await prisma.emailOtp.findFirst({
    where: { email, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return null;

  if (otp.attempts >= MAX_ATTEMPTS) {
    await prisma.emailOtp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });
    return null;
  }

  const matches = crypto.timingSafeEqual(
    Buffer.from(otp.codeHash),
    Buffer.from(hashCode(email, cleanCode)),
  );

  if (!matches) {
    await prisma.emailOtp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    return null;
  }

  // Success: consume the code and ensure the user exists.
  await prisma.emailOtp.update({
    where: { id: otp.id },
    data: { consumedAt: new Date() },
  });

  const user = await prisma.user.upsert({
    where: { email },
    update: { emailVerified: new Date() },
    create: {
      email,
      name: email.split("@")[0],
      emailVerified: new Date(),
    },
    select: { id: true, email: true, name: true },
  });

  return { id: user.id, email: user.email!, name: user.name };
}
