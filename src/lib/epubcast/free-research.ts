// Free, key-free research for EpubCast episodes.
//
// Every source here is a public API that needs no account, no key and no
// billing: Wikipedia and Wikiquote (MediaWiki REST/Action APIs), Open Library,
// and Gutendex (Project Gutenberg). Network failures degrade to "no research"
// rather than failing the episode, so generation still works fully offline.

import type { Research, ResearchSource } from "@/lib/epubcast/script";

const UA = "EpubCast/1.0 (open-source reading app)";
const TIMEOUT_MS = 6000;

/** A short fact the hosts can cite on air. */
export interface ResearchFact {
  /** Where it came from, e.g. "Wikipedia". */
  source: string;
  text: string;
  url?: string;
}

export interface FreeResearch extends Research {
  facts: ResearchFact[];
  quotes: { text: string; url?: string }[];
}

async function getJson(url: string): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // offline, blocked, rate-limited — all non-fatal
  } finally {
    clearTimeout(timer);
  }
}

/** Trim wiki markup and reference clutter out of a snippet. */
function clean(text: string): string {
  return String(text || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#\d+;/g, " ")
    .replace(/\[\d+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sentences(text: string, max: number): string[] {
  return (text.match(/[^.!?]+[.!?]+/g) || [])
    .map((s) => s.trim())
    .filter((s) => s.length > 40)
    .slice(0, max);
}

/** Wikipedia page summary for a title (no key). */
async function wikipediaSummary(
  title: string,
): Promise<{ extract: string; url: string; title: string } | null> {
  const data = await getJson(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
  );
  if (!data || data.type === "disambiguation" || !data.extract) return null;
  return {
    extract: clean(data.extract),
    url: data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    title: data.title ?? title,
  };
}

/** Best-matching Wikipedia article title for a free-text query (no key). */
async function wikipediaSearch(query: string): Promise<string | null> {
  const data = await getJson(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query,
    )}&srlimit=1&format=json&origin=*`,
  );
  const hit = data?.query?.search?.[0]?.title;
  return typeof hit === "string" ? hit : null;
}

/** Quotations from Wikiquote for a book or author (no key). */
async function wikiquote(
  query: string,
): Promise<{ text: string; url?: string }[]> {
  const search = await getJson(
    `https://en.wikiquote.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query,
    )}&srlimit=1&format=json&origin=*`,
  );
  const title = search?.query?.search?.[0]?.title;
  if (!title) return [];

  const page = await getJson(
    `https://en.wikiquote.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=${encodeURIComponent(
      title,
    )}&format=json&origin=*`,
  );
  const pages = page?.query?.pages;
  const first = pages && Object.values(pages)[0];
  const extract = clean((first as any)?.extract ?? "");
  if (!extract) return [];

  const url = `https://en.wikiquote.org/wiki/${encodeURIComponent(title)}`;
  return extract
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 45 && l.length < 320 && !/^=/.test(l))
    .slice(0, 4)
    .map((text) => ({ text, url }));
}

/** Open Library record — subjects and edition counts (no key). */
async function openLibrary(
  title: string,
  author: string | null,
): Promise<{ subjects: string[]; firstYear?: number; editions?: number; url?: string } | null> {
  const q = [title, author].filter(Boolean).join(" ");
  const data = await getJson(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=1&fields=title,author_name,first_publish_year,subject,edition_count,key`,
  );
  const doc = data?.docs?.[0];
  if (!doc) return null;
  return {
    subjects: Array.isArray(doc.subject) ? doc.subject.slice(0, 8).map(clean) : [],
    firstYear: typeof doc.first_publish_year === "number" ? doc.first_publish_year : undefined,
    editions: typeof doc.edition_count === "number" ? doc.edition_count : undefined,
    url: doc.key ? `https://openlibrary.org${doc.key}` : undefined,
  };
}

/** Project Gutenberg availability and popularity (no key). */
async function gutendex(
  title: string,
  author: string | null,
): Promise<{ downloads: number; url: string; title: string } | null> {
  const q = [title, author].filter(Boolean).join(" ");
  const data = await getJson(
    `https://gutendex.com/books?search=${encodeURIComponent(q)}`,
  );
  const book = data?.results?.[0];
  if (!book) return null;
  return {
    downloads: Number(book.download_count) || 0,
    url: `https://www.gutenberg.org/ebooks/${book.id}`,
    title: clean(book.title),
  };
}

function pushSource(list: ResearchSource[], seen: Set<string>, s: ResearchSource) {
  if (!s.url || seen.has(s.url)) return;
  seen.add(s.url);
  list.push(s);
}

/**
 * Gather free background on a book: encyclopedic context, themes/subjects,
 * quotations and public-domain availability. Everything is best-effort — any
 * source that fails is simply skipped.
 */
export async function freeResearch(input: {
  bookTitle: string;
  author: string | null;
  chapterTitle: string;
}): Promise<FreeResearch> {
  const { bookTitle, author } = input;
  const facts: ResearchFact[] = [];
  const sources: ResearchSource[] = [];
  const seen = new Set<string>();

  // Run the lookups concurrently; each resolves to null on failure.
  const bookTitleGuess = await wikipediaSearch(
    `${bookTitle}${author ? ` ${author} novel book` : " book"}`,
  );

  const [bookPage, authorPage, quotes, ol, gut] = await Promise.all([
    bookTitleGuess ? wikipediaSummary(bookTitleGuess) : Promise.resolve(null),
    author ? wikipediaSearch(author).then((t) => (t ? wikipediaSummary(t) : null)) : Promise.resolve(null),
    wikiquote(`${bookTitle}${author ? ` ${author}` : ""}`),
    openLibrary(bookTitle, author),
    gutendex(bookTitle, author),
  ]);

  if (bookPage) {
    for (const s of sentences(bookPage.extract, 3)) {
      facts.push({ source: "Wikipedia", text: s, url: bookPage.url });
    }
    pushSource(sources, seen, { title: `Wikipedia — ${bookPage.title}`, url: bookPage.url });
  }

  if (authorPage) {
    for (const s of sentences(authorPage.extract, 2)) {
      facts.push({ source: "Wikipedia", text: s, url: authorPage.url });
    }
    pushSource(sources, seen, { title: `Wikipedia — ${authorPage.title}`, url: authorPage.url });
  }

  if (ol) {
    if (ol.firstYear) {
      facts.push({
        source: "Open Library",
        text: `Open Library dates the first published edition to ${ol.firstYear}.`,
        url: ol.url,
      });
    }
    if (ol.editions && ol.editions > 1) {
      facts.push({
        source: "Open Library",
        text: `It catalogues ${ol.editions.toLocaleString()} editions of this book, which tells you something about how often people keep coming back to it.`,
        url: ol.url,
      });
    }
    if (ol.subjects.length) {
      facts.push({
        source: "Open Library",
        text: `Librarians file it under subjects like ${ol.subjects.slice(0, 4).join(", ")}.`,
        url: ol.url,
      });
    }
    if (ol.url) pushSource(sources, seen, { title: "Open Library record", url: ol.url });
  }

  if (gut) {
    facts.push({
      source: "Project Gutenberg",
      text: `It's in the public domain on Project Gutenberg, downloaded ${gut.downloads.toLocaleString()} times there — so anyone listening can read along for free.`,
      url: gut.url,
    });
    pushSource(sources, seen, { title: `Project Gutenberg — ${gut.title}`, url: gut.url });
  }

  for (const q of quotes) {
    if (q.url) pushSource(sources, seen, { title: "Wikiquote", url: q.url });
  }

  const brief = facts.length
    ? facts.map((f) => `${f.text} (${f.source})`).join("\n")
    : "";

  return { brief, sources, facts, quotes };
}
