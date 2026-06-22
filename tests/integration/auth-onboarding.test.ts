import { describe, it, expect, beforeEach, vi } from "vitest";

const authState = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/lib/auth", () => ({
  auth: async () =>
    authState.userId ? { user: { id: authState.userId } } : null,
}));

import { prisma } from "@/lib/prisma";
import { resetDb } from "../helpers/db";
import {
  createEmailOtp,
  verifyEmailOtp,
  OtpRateLimitError,
} from "@/lib/otp";
import { POST as requestOtp } from "@/app/api/auth/email/request/route";
import { GET as getOnboarding, PUT as putOnboarding } from "@/app/api/onboarding/route";

beforeEach(async () => {
  await resetDb();
  authState.userId = null;
});

describe("email OTP", () => {
  it("issues a 6-digit code and stores only its hash", async () => {
    const { code } = await createEmailOtp("Reader@Example.com");
    expect(code).toMatch(/^\d{6}$/);

    const rows = await prisma.emailOtp.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("reader@example.com"); // normalized
    expect(rows[0].codeHash).not.toContain(code); // never stored in plaintext
  });

  it("verifies the correct code and creates the user", async () => {
    const email = "newreader@example.com";
    const { code } = await createEmailOtp(email);

    const user = await verifyEmailOtp(email, code);
    expect(user).not.toBeNull();
    expect(user!.email).toBe(email);

    const dbUser = await prisma.user.findUnique({ where: { email } });
    expect(dbUser?.emailVerified).toBeTruthy();
  });

  it("rejects a wrong code and counts the attempt", async () => {
    const email = "a@example.com";
    await createEmailOtp(email);

    expect(await verifyEmailOtp(email, "000000")).toBeNull();
    const otp = await prisma.emailOtp.findFirst({ where: { email } });
    expect(otp?.attempts).toBe(1);
  });

  it("does not allow reusing a consumed code", async () => {
    const email = "reuse@example.com";
    const { code } = await createEmailOtp(email);
    expect(await verifyEmailOtp(email, code)).not.toBeNull();
    expect(await verifyEmailOtp(email, code)).toBeNull();
  });

  it("treats expired codes as invalid", async () => {
    const email = "expired@example.com";
    const { code } = await createEmailOtp(email);
    await prisma.emailOtp.updateMany({
      where: { email },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await verifyEmailOtp(email, code)).toBeNull();
  });

  it("locks out after too many attempts", async () => {
    const email = "bruteforce@example.com";
    const { code } = await createEmailOtp(email);
    for (let i = 0; i < 5; i++) {
      await verifyEmailOtp(email, "111111");
    }
    // Even the correct code now fails — the code is locked.
    expect(await verifyEmailOtp(email, code)).toBeNull();
  });

  it("throttles rapid resends", async () => {
    await createEmailOtp("throttle@example.com");
    await expect(createEmailOtp("throttle@example.com")).rejects.toBeInstanceOf(
      OtpRateLimitError,
    );
  });

  it("issuing a new code invalidates the previous one", async () => {
    const email = "rotate@example.com";
    const first = await createEmailOtp(email);
    // Bypass the resend throttle by ageing the first record.
    await prisma.emailOtp.updateMany({
      where: { email },
      data: { createdAt: new Date(Date.now() - 60_000) },
    });
    await createEmailOtp(email);
    expect(await verifyEmailOtp(email, first.code)).toBeNull();
  });

  it("request route returns a dev code in test mode", async () => {
    const res = await requestOtp(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ email: "route@example.com" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.devCode).toMatch(/^\d{6}$/);
  });

  it("request route rejects an invalid email", async () => {
    const res = await requestOtp(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ email: "not-an-email" }),
      }),
    );
    expect(res.status).toBe(422);
  });
});

describe("onboarding", () => {
  it("reports not-onboarded for a fresh user, then completes", async () => {
    const user = await prisma.user.create({
      data: { email: "fresh@example.com", name: "fresh" },
    });
    authState.userId = user.id;

    const before = await (await getOnboarding()).json();
    expect(before.onboarded).toBe(false);

    const putRes = await putOnboarding(
      new Request("http://test", {
        method: "PUT",
        body: JSON.stringify({
          name: "Ada Lovelace",
          theme: "sepia",
          fontFamily: "dyslexic",
          fontSize: 22,
        }),
      }),
    );
    expect(putRes.status).toBe(200);

    const after = await (await getOnboarding()).json();
    expect(after.onboarded).toBe(true);
    expect(after.name).toBe("Ada Lovelace");

    const prefs = await prisma.preferences.findUnique({
      where: { userId: user.id },
    });
    expect(prefs?.theme).toBe("sepia");
    expect(prefs?.fontSize).toBe(22);
  });

  it("requires authentication", async () => {
    authState.userId = null;
    const res = await putOnboarding(
      new Request("http://test", {
        method: "PUT",
        body: JSON.stringify({ name: "X" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects an empty name", async () => {
    const user = await prisma.user.create({
      data: { email: "noname@example.com" },
    });
    authState.userId = user.id;
    const res = await putOnboarding(
      new Request("http://test", {
        method: "PUT",
        body: JSON.stringify({ name: "" }),
      }),
    );
    expect(res.status).toBe(422);
  });
});
