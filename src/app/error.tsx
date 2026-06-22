"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
      <div className="text-5xl" aria-hidden>
        🌧️
      </div>
      <h1 className="text-xl font-semibold text-slate-800">
        Something went wrong
      </h1>
      <p className="max-w-sm text-sm text-slate-500">
        An unexpected error occurred. You can try again, or head back to your
        library.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Try again
        </button>
        <Link
          href="/library"
          className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700"
        >
          Library
        </Link>
      </div>
    </main>
  );
}
