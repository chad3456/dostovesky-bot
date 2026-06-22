"use client";

import { PanelHeader } from "@/components/reader/settings-panel";

export interface TocItem {
  label: string;
  href: string;
  depth: number;
}

export function ContentsPanel({
  toc,
  onNavigate,
  onClose,
  currentHref,
}: {
  toc: TocItem[];
  onNavigate: (href: string) => void;
  onClose: () => void;
  currentHref: string | null;
}) {
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Contents" onClose={onClose} />
      <nav className="scroll-thin flex-1 overflow-y-auto p-2">
        {toc.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">
            No table of contents available.
          </p>
        ) : (
          <ul>
            {toc.map((item, i) => {
              const active =
                currentHref &&
                item.href.split("#")[0] === currentHref.split("#")[0];
              return (
                <li key={`${item.href}-${i}`}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.href)}
                    className={`block w-full truncate rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                      active ? "font-semibold text-brand-700" : "text-slate-700"
                    }`}
                    style={{ paddingLeft: `${0.75 + item.depth * 0.85}rem` }}
                    title={item.label}
                  >
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </div>
  );
}
