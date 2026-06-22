"use client";

import Link from "next/link";
import { useState } from "react";
import type { BookSummary } from "@/lib/types";

export function BookCard({
  book,
  onDelete,
  onShare,
}: {
  book: BookSummary;
  onDelete: () => void;
  onShare: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const pct = Math.round((book.progress || 0) * 100);

  return (
    <div className="group relative">
      <Link
        href={`/read/${book.id}`}
        className="block overflow-hidden rounded-xl bg-slate-200 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md focus-visible:ring-brand-500"
      >
        <div className="relative aspect-[2/3] w-full">
          {book.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={book.cover}
              alt={`Cover of ${book.title}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-brand-500 to-indigo-700 p-3 text-center">
              <span className="line-clamp-4 text-sm font-semibold text-white">
                {book.title}
              </span>
            </div>
          )}
          {pct > 0 && (
            <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/20">
              <div
                className="h-full bg-brand-400"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
            </div>
          )}
        </div>
      </Link>

      <button
        type="button"
        aria-label="Book options"
        onClick={() => setMenu((v) => !v)}
        className="absolute right-1.5 top-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
      >
        ⋮
      </button>

      {menu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} aria-hidden />
          <div
            role="menu"
            className="absolute right-1.5 top-10 z-20 w-40 animate-fade-in rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          >
            <Link
              href={`/read/${book.id}`}
              className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              role="menuitem"
            >
              Open
            </Link>
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                onShare();
              }}
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              role="menuitem"
            >
              Share
            </button>
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                onDelete();
              }}
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
              role="menuitem"
            >
              Remove
            </button>
          </div>
        </>
      )}

      <div className="mt-2 px-0.5">
        <p className="line-clamp-2 text-sm font-medium leading-tight text-slate-800">
          {book.title}
        </p>
        {book.author && (
          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
            {book.author}
          </p>
        )}
        {pct > 0 && (
          <p className="mt-0.5 text-xs text-brand-600">{pct}% read</p>
        )}
      </div>
    </div>
  );
}
