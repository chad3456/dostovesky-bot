import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

const FEATURES = [
  {
    title: "Read anywhere",
    body: "Your library and your exact reading position sync across phone, tablet, laptop and Mac.",
    icon: "📚",
  },
  {
    title: "Highlight & note",
    body: "Mark passages in five colors, add notes, and find every highlight in one place.",
    icon: "✍️",
  },
  {
    title: "Made for every reader",
    body: "Adjustable fonts, sizes, spacing, themes and a dyslexia-friendly typeface for all ages.",
    icon: "🔆",
  },
  {
    title: "Swift uploads",
    body: "Drop in an EPUB and start reading in seconds. We extract the cover and details for you.",
    icon: "⚡",
  },
];

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/library");

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl" />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 text-xl font-bold text-brand-700">
          <span aria-hidden>📖</span> Lumen
        </div>
        <Link
          href="/login"
          className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          Sign in
        </Link>
      </header>

      <section className="relative mx-auto max-w-4xl px-6 pb-10 pt-16 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
          Your books.{" "}
          <span className="bg-gradient-to-r from-brand-600 to-indigo-400 bg-clip-text text-transparent">
            Everywhere.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          Lumen is a calm, beautiful reader for your EPUB library. Upload once,
          read on any device, highlight what matters, and never lose your place.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className="w-full rounded-full bg-brand-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 sm:w-auto"
          >
            Get started — it&apos;s free
          </Link>
          <a
            href="#features"
            className="w-full rounded-full border border-slate-300 bg-white px-8 py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
          >
            Learn more
          </a>
        </div>
      </section>

      <section
        id="features"
        className="relative mx-auto grid max-w-5xl gap-6 px-6 py-16 sm:grid-cols-2"
      >
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur"
          >
            <div className="text-3xl" aria-hidden>
              {f.icon}
            </div>
            <h3 className="mt-3 text-lg font-semibold text-slate-900">
              {f.title}
            </h3>
            <p className="mt-1 text-slate-600">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="relative mx-auto max-w-6xl px-6 py-10 text-center text-sm text-slate-500">
        Built for readers of every age. © {new Date().getFullYear()} Lumen.
      </footer>
    </main>
  );
}
