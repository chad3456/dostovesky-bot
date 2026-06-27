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
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-white px-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <Link
          href="/"
          className="mb-6 flex items-center justify-center gap-2 text-2xl font-bold text-brand-700"
        >
          <span aria-hidden>📖</span> Lumen
        </Link>
        <h1 className="text-center text-xl font-semibold text-slate-900">
          Welcome back
        </h1>
        <p className="mt-1 text-center text-sm text-slate-500">
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
