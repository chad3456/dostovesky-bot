"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useState } from "react";

export function AppHeader({
  name,
  email,
  image,
  syncCode,
}: {
  name: string | null;
  email: string | null;
  image: string | null;
  syncCode?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const initial = (name || email || "?").charAt(0).toUpperCase();

  async function copyCode() {
    if (!syncCode) return;
    try {
      await navigator.clipboard.writeText(syncCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href="/library"
          className="flex items-center gap-2 text-lg font-bold text-brand-700"
        >
          <span aria-hidden>📖</span> Lumen
        </Link>

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-3 transition hover:bg-slate-50"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Account menu"
          >
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt=""
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                {initial}
              </span>
            )}
            <span className="hidden max-w-[10rem] truncate text-sm font-medium text-slate-700 sm:block">
              {name || email}
            </span>
          </button>

          {open && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setOpen(false)}
                aria-hidden
              />
              <div
                role="menu"
                className="absolute right-0 z-20 mt-2 w-56 animate-fade-in rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
              >
                <div className="px-3 py-2 text-sm">
                  <p className="font-medium text-slate-800">{name || "Reader"}</p>
                  <p className="truncate text-xs text-slate-500">
                    {email || "Synced library"}
                  </p>
                </div>

                {syncCode && (
                  <>
                    <hr className="my-1 border-slate-100" />
                    <div className="px-3 py-2">
                      <p className="text-xs font-medium text-slate-500">
                        Your sync code
                      </p>
                      <p className="mt-1 font-mono text-sm tracking-wide text-slate-800">
                        {syncCode}
                      </p>
                      <p className="mt-1 text-[11px] leading-snug text-slate-400">
                        Enter this on another device to open the same library.
                      </p>
                      <button
                        type="button"
                        onClick={copyCode}
                        className="mt-2 w-full rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                      >
                        {copied ? "Copied!" : "Copy code"}
                      </button>
                    </div>
                  </>
                )}

                <hr className="my-1 border-slate-100" />
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
                  role="menuitem"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
