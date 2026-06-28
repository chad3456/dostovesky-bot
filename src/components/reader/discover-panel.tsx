"use client";

import { buildSocialLinks } from "@/lib/social";
import { PanelHeader } from "@/components/reader/settings-panel";

export function DiscoverPanel({
  title,
  author,
  onClose,
}: {
  title: string;
  author?: string | null;
  onClose: () => void;
}) {
  const groups = buildSocialLinks(title, author);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Discover" onClose={onClose} />
      <div className="scroll-thin flex-1 overflow-y-auto p-4">
        <p className="mb-4 text-xs text-slate-500">
          Quotes, discussions and essays about{" "}
          <span className="font-medium text-slate-700">{title}</span>
          {author ? ` by ${author}` : ""}.
        </p>

        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.id}>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span aria-hidden>{group.icon}</span>
                {group.title}
              </h3>
              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <li key={item.url}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg border border-slate-200 px-3 py-2 transition hover:border-brand-300 hover:bg-brand-50"
                    >
                      <span className="flex items-center justify-between gap-2 text-sm font-medium text-slate-800">
                        {item.label}
                        <span aria-hidden className="text-slate-400">
                          ↗
                        </span>
                      </span>
                      {item.hint && (
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {item.hint}
                        </span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-6 text-center text-[11px] leading-snug text-slate-400">
          Links open the latest results on each platform in a new tab.
        </p>
      </div>
    </div>
  );
}
