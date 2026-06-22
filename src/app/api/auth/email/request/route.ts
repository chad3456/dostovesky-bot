import { handle, json, error } from "@/lib/api";
import { requestOtpSchema } from "@/lib/validation";
import { createEmailOtp, OtpRateLimitError } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// POST /api/auth/email/request — issue a one-time passcode to an email.
export async function POST(req: Request) {
  return handle(async () => {
    const { email } = requestOtpSchema.parse(await req.json());

    let code: string;
    try {
      ({ code } = await createEmailOtp(email));
    } catch (e) {
      if (e instanceof OtpRateLimitError) return error(e.message, 429);
      throw e;
    }

    await sendOtpEmail(email, code);

    // Surface the code to the client ONLY in test/dev mode so automated and
    // local flows can complete without a real mailbox. Never in production.
    const devCode =
      process.env.ENABLE_TEST_LOGIN === "true" &&
      process.env.NODE_ENV !== "production"
        ? code
        : undefined;

    return json({ ok: true, ...(devCode ? { devCode } : {}) });
  });
}
