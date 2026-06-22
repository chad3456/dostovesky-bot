interface SendArgs {
  to: string;
  subject: string;
  text: string;
  html: string;
}

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.EMAIL_FROM);
}

/**
 * Deliver an email. Uses SMTP (via nodemailer) when configured; otherwise
 * logs to the server console so local development still works end-to-end.
 */
export async function sendEmail({ to, subject, text, html }: SendArgs): Promise<void> {
  if (!smtpConfigured()) {
    console.info(
      `\n[email:dev] To: ${to}\n[email:dev] Subject: ${subject}\n[email:dev] ${text}\n`,
    );
    return;
  }

  // Imported lazily so the dependency is only loaded when SMTP is in use.
  const nodemailer = (await import("nodemailer")).default;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASSWORD
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
  });

  await transport.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
    html,
  });
}

/** Send a sign-in passcode email. */
export async function sendOtpEmail(email: string, code: string): Promise<void> {
  const subject = `Your Lumen sign-in code: ${code}`;
  const text = `Your Lumen sign-in code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`;
  const html = `
  <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f2937">
    <h1 style="font-size:20px;margin:0 0 8px">📖 Lumen</h1>
    <p style="margin:0 0 16px;color:#475569">Use this code to sign in. It expires in 10 minutes.</p>
    <div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#eef2ff;color:#4338ca;text-align:center;padding:16px;border-radius:12px">${code}</div>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">If you didn't request this, you can safely ignore this email.</p>
  </div>`;
  await sendEmail({ to: email, subject, text, html });
}
