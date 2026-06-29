import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/library");

  const googleEnabled = Boolean(
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
  );
  const testEnabled =
    process.env.ENABLE_TEST_LOGIN === "true" &&
    process.env.NODE_ENV !== "production";
  // Email sign-in is only offered when codes can actually be delivered: SMTP is
  // configured, or the dev/test mode (which surfaces the code on screen). This
  // avoids the "code sent" dead-end when no mail provider exists.
  const emailEnabled =
    Boolean(process.env.SMTP_HOST && process.env.EMAIL_FROM) || testEnabled;

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="vintage-card w-full max-w-sm rounded-2xl p-8">
        <Link
          href="/"
          className="mb-4 flex items-center justify-center gap-2 text-brand-800"
        >
          <span aria-hidden className="text-2xl">📖</span>
          <span className="font-display text-5xl leading-none">Lumen</span>
        </Link>
        <h1 className="font-display text-center text-4xl text-ink">Welcome back</h1>
        <hr className="vintage-rule mx-auto my-2 max-w-[12rem]" />
        <p className="mt-1 text-center text-sm italic text-ink-soft">
          Sign in to open your library on every device.
        </p>

        <LoginForm
          googleEnabled={googleEnabled}
          testEnabled={testEnabled}
          emailEnabled={emailEnabled}
        />

        <p className="mt-6 text-center text-xs text-slate-400">
          By continuing you agree to read responsibly. 📚
        </p>
      </div>
    </main>
  );
}
