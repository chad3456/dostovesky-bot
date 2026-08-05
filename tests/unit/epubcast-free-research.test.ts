import { describe, it, expect, vi, afterEach } from "vitest";
import { freeResearch } from "@/lib/epubcast/free-research";
import { activeEngine, claudeRequestedButUnavailable } from "@/lib/epubcast/engine";

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  delete process.env.EPUBCAST_ENGINE;
  delete process.env.ANTHROPIC_API_KEY;
});

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => "application/json" },
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function mockFetch(routes: Record<string, unknown>) {
  global.fetch = vi.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    const key = Object.keys(routes).find((k) => u.includes(k));
    if (!key) {
      return {
        ok: false,
        status: 404,
        headers: { get: () => "application/json" },
        text: async () => "{}",
      } as unknown as Response;
    }
    return jsonResponse(routes[key]);
  }) as unknown as typeof fetch;
}

describe("freeResearch", () => {
  it("gathers facts and sources from keyless public APIs", async () => {
    mockFetch({
      "list=search&srsearch": {
        query: { search: [{ title: "Crime and Punishment" }] },
      },
      "rest_v1/page/summary": {
        title: "Crime and Punishment",
        extract:
          "Crime and Punishment is a novel by the Russian author Fyodor Dostoevsky. It was first published in the literary journal The Russian Messenger in 1866.",
        content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Crime_and_Punishment" } },
      },
      "openlibrary.org/search.json": {
        docs: [
          {
            first_publish_year: 1866,
            edition_count: 1200,
            subject: ["Guilt", "Murder", "Redemption", "Russia"],
            key: "/works/OL1",
          },
        ],
      },
      "gutendex.com": {
        results: [{ id: 2554, title: "Crime and Punishment", download_count: 90000 }],
      },
    });

    const r = await freeResearch({
      bookTitle: "Crime and Punishment",
      author: "Fyodor Dostoevsky",
      chapterTitle: "The Confession",
    });

    expect(r.facts.length).toBeGreaterThan(0);
    const all = r.facts.map((f) => f.text).join(" ");
    expect(all).toContain("1866");
    expect(all).toContain("Guilt");
    expect(all).toMatch(/public domain on Project Gutenberg/);
    expect(r.sources.some((s) => s.url.includes("wikipedia.org"))).toBe(true);
    expect(r.sources.some((s) => s.url.includes("gutenberg.org"))).toBe(true);
    expect(r.brief.length).toBeGreaterThan(0);
  });

  it("degrades to empty research when every source fails (offline)", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const r = await freeResearch({
      bookTitle: "Some Book",
      author: null,
      chapterTitle: "One",
    });
    expect(r.facts).toEqual([]);
    expect(r.sources).toEqual([]);
    expect(r.brief).toBe("");
  });

  it("skips Wikipedia disambiguation pages", async () => {
    mockFetch({
      "list=search&srsearch": { query: { search: [{ title: "Ambiguous" }] } },
      "rest_v1/page/summary": { type: "disambiguation", extract: "May refer to..." },
    });
    const r = await freeResearch({
      bookTitle: "Ambiguous",
      author: null,
      chapterTitle: "One",
    });
    expect(r.sources.some((s) => s.url.includes("wikipedia"))).toBe(false);
  });
});

describe("activeEngine", () => {
  it("defaults to the free engine, so nothing can be billed by accident", () => {
    expect(activeEngine()).toBe("free");
  });

  it("stays free when only an API key is present", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    expect(activeEngine()).toBe("free");
  });

  it("uses Claude only when explicitly opted in AND a key exists", () => {
    process.env.EPUBCAST_ENGINE = "claude";
    expect(activeEngine()).toBe("free"); // no key yet
    expect(claudeRequestedButUnavailable()).toBe(true);

    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    expect(activeEngine()).toBe("claude");
    expect(claudeRequestedButUnavailable()).toBe(false);
  });
});
