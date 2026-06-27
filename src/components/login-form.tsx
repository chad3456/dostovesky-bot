"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { api, ApiError } from "@/lib/fetcher";

type Phase = "email" | "code";

export function LoginForm({
  googleEnabled,
  testEnabled,
  emailEnabled = true,
}: {
  googleEnabled: boolean;
  testEnabled: boolean;
  emailEnabled?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Sync Code (passwordless cross-device) state.
  const [syncInput, setSyncInput] = useState("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function createLibrary() {
    setErr(null);
    setLoading("sync-new");
    try {
      const { code } = await api<{ code: string }>("/api/sync/new", {
        method: "POST",
      });
      const res = await signIn("sync-code", { code, redirect: false });
      if (res?.error) throw new Error("sign-in failed");
      setCreatedCode(code); // show it so the user can save/pair before leaving
    } catch (e) {
      setErr(
        e instanceof ApiError ? e.message : "Couldn't create a library. Try again.",
      );
    } finally {
      setLoading(null);
    }
  }

  async function openLibrary(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (syncInput.trim().length < 12) {
      setErr("Enter your full sync code.");
      return;
    }
    setLoading("sync-open");
    const res = await signIn("sync-code", {
      code: syncInput.trim(),
      redirect: false,
    });
    if (res?.error) {
      setErr("That sync code wasn't found. Check it and try again.");
      setLoading(null);
    } else {
      window.location.href = "/library";
    }
  }

  async function copyCreated() {
    if (!createdCode) return;
    try {
      await navigator.clipboard.writeText(createdCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    setErr(null);
    setInfo(null);
    if (!email.trim()) {
      setErr("Enter your email to continue.");
      return;
    }
    setLoading("request");
    try {
      const res = await api<{ ok: boolean; devCode?: string }>(
        "/api/auth/email/request",
        { method: "POST", body: JSON.stringify({ email: email.trim() }) },
      );
      setPhase("code");
      setInfo(`We sent a 6-digit code to ${email.trim()}.`);
      setDevCode(res.devCode ?? null);
    } catch (e) {
      setErr(
        e instanceof ApiError ? e.message : "Could not send a code. Try again.",
      );
    } finally {
      setLoading(null);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setErr("Enter the 6-digit code from your email.");
      return;
    }
    setLoading("verify");
    const res = await signIn("email-otp", {
      email: email.trim(),
      code: code.trim(),
      redirect: false,
    });
    if (res?.error) {
      setErr("That code is invalid or expired. Please try again.");
      setLoading(null);
    } else {
      window.location.href = "/library";
    }
  }

  async function handleGoogle() {
    setErr(null);
    setLoading("google");
    await signIn("google", { callbackUrl: "/library" });
  }

  async function handleTest(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!email.trim()) {
      setErr("Enter an email to continue.");
      return;
    }
    setLoading("test");
    const res = await signIn("test-login", {
      email: email.trim(),
      redirect: false,
    });
    if (res?.error) {
      setErr("Could not sign in. Please try again.");
      setLoading(null);
    } else {
      window.location.href = "/library";
    }
  }

  // After creating a library: show the code so the user can save it / pair
  // another device before continuing.
  if (createdCode) {
    return (
      <div className="mt-8 space-y-4 text-center">
        <p className="text-sm text-slate-600">
          Your library is ready. <strong>Save this sync code</strong> — enter it
          on any other device to open the same books and highlights.
        </p>
        <div className="rounded-xl border-2 border-brand-200 bg-brand-50 px-4 py-4">
          <p className="font-mono text-2xl font-bold tracking-wide text-brand-700">
            {createdCode}
          </p>
        </div>
        <button
          type="button"
          onClick={copyCreated}
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {copied ? "Copied!" : "Copy code"}
        </button>
        <a
          href="/library"
          className="block w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700"
        >
          Continue to my library →
        </a>
        <p className="text-xs text-slate-400">
          You can find this code again anytime from the account menu.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      {/* Sync Code — passwordless, works across devices */}
      <div className="rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-800">
          📚 Read across devices
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          No account needed. Create a library, then use its sync code on your
          other devices.
        </p>
        <button
          type="button"
          onClick={createLibrary}
          disabled={loading !== null}
          className="mt-3 w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {loading === "sync-new" ? "Creating…" : "Create a new library"}
        </button>
        <form onSubmit={openLibrary} className="mt-3 flex gap-2" aria-label="Open with sync code">
          <input
            type="text"
            placeholder="XXXX-XXXX-XXXX"
            value={syncInput}
            onChange={(e) => setSyncInput(e.target.value.toUpperCase())}
            className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-sm uppercase tracking-wide text-slate-800 focus:border-brand-500"
            aria-label="Sync code"
          />
          <button
            type="submit"
            disabled={loading !== null}
            className="shrink-0 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {loading === "sync-open" ? "Opening…" : "Open"}
          </button>
        </form>
      </div>

      {emailEnabled && (
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" /> or use email{" "}
          <span className="h-px flex-1 bg-slate-200" />
        </div>
      )}

      {emailEnabled && (phase === "email" ? (
        <form onSubmit={requestCode} className="space-y-3" aria-label="Email sign-in">
          <input
            type="email"
            required
            autoFocus
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-800 focus:border-brand-500"
            aria-label="Email"
          />
          <button
            type="submit"
            disabled={loading !== null}
            className="w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {loading === "request" ? "Sending code…" : "Send sign-in code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-3" aria-label="Enter code">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            autoFocus
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl tracking-[0.5em] text-slate-800 focus:border-brand-500"
            aria-label="6-digit code"
          />
          <button
            type="submit"
            disabled={loading !== null}
            className="w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {loading === "verify" ? "Verifying…" : "Verify & continue"}
          </button>
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setPhase("email");
                setCode("");
                setDevCode(null);
                setInfo(null);
              }}
              className="font-medium text-slate-500 hover:text-slate-800"
            >
              ← Use a different email
            </button>
            <button
              type="button"
              onClick={() => requestCode()}
              disabled={loading !== null}
              className="font-medium text-brand-600 hover:underline disabled:opacity-60"
            >
              Resend code
            </button>
          </div>
          {devCode && (
            <p
              data-testid="dev-otp"
              className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-700"
            >
              Dev mode — your code is <span className="font-mono font-bold">{devCode}</span>
            </p>
          )}
        </form>
      ))}

      {info && (
        <p role="status" className="text-center text-sm text-emerald-600">
          {info}
        </p>
      )}
      {err && (
        <p role="alert" className="text-center text-sm text-rose-600">
          {err}
        </p>
      )}

      {(googleEnabled || testEnabled) && (
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" /> or{" "}
          <span className="h-px flex-1 bg-slate-200" />
        </div>
      )}

      {googleEnabled && (
        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading !== null}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
        >
          <GoogleIcon />
          {loading === "google" ? "Redirecting…" : "Continue with Google"}
        </button>
      )}

      {testEnabled && (
        <form onSubmit={handleTest} aria-label="Demo login">
          <button
            type="submit"
            disabled={loading !== null || !email.trim()}
            className="w-full rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
            title="Skips the code step using the email above (dev/test only)"
          >
            {loading === "test" ? "Signing in…" : "Demo quick sign-in"}
          </button>
        </form>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
