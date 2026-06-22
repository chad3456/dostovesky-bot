import Link from "next/link";
import { resolveShareToken } from "@/lib/share";
import { ReaderClient } from "@/components/reader/reader-client";

export const dynamic = "force-dynamic";

export default async function SharedReadPage({
  params,
}: {
  params: { token: string };
}) {
  const link = await resolveShareToken(params.token);

  if (!link) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
        <div className="text-5xl" aria-hidden>
          🔗
        </div>
        <h1 className="text-xl font-semibold text-slate-800">
          This shared link is invalid or has expired
        </h1>
        <p className="text-sm text-slate-500">
          Ask the person who shared it for a fresh link.
        </p>
        <Link
          href="/"
          className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white"
        >
          Go to Lumen
        </Link>
      </main>
    );
  }

  return (
    <ReaderClient
      title={link.book.title}
      fileUrl={`/api/shared/${params.token}/file`}
      bookId={null}
      readOnly
    />
  );
}
