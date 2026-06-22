import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
      <div className="text-5xl" aria-hidden>
        📭
      </div>
      <h1 className="text-xl font-semibold text-slate-800">Page not found</h1>
      <p className="text-sm text-slate-500">
        The page or book you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/library"
        className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white"
      >
        Back to library
      </Link>
    </main>
  );
}
