import { describe, it, expect, beforeEach, vi } from "vitest";

// No auth anywhere in EpubCast; keep the import chain off real next-auth.
vi.mock("@/lib/auth", () => ({ auth: async () => null }));

// Stand in for Claude so the pipeline is testable without an API key.
const fake = vi.hoisted(() => ({
  research: { brief: "Critics read this chapter as a turning point.", sources: [
    { title: "An Essay", url: "https://example.com/essay" },
  ] },
  segmentWords: 12,
  fail: false,
}));

vi.mock("@/lib/epubcast/generate", async () => {
  const actual = await vi.importActual<typeof import("@/lib/epubcast/generate")>(
    "@/lib/epubcast/generate",
  );
  return {
    ...actual,
    hasApiKey: () => true,
    researchChapter: vi.fn(async () => fake.research),
    generateSegment: vi.fn(async ({ segmentIndex }: { segmentIndex: number }) => {
      if (fake.fail) throw new Error("model unavailable");
      return [
        { speaker: "A", text: `Segment ${segmentIndex + 1} opening line here.` },
        { speaker: "B", text: "And a reply that adds several more words." },
      ];
    }),
  };
});

import { prisma } from "@/lib/prisma";
import { resetDb } from "../helpers/db";
import { createEpub } from "../fixtures/make-epub";
import { POST as uploadPodcast, GET as listPodcasts } from "@/app/api/epubcast/route";
import { GET as getPodcast } from "@/app/api/epubcast/[id]/route";
import { POST as generateStep } from "@/app/api/epubcast/episodes/[episodeId]/generate/route";
import { POST as completeEp } from "@/app/api/epubcast/episodes/[episodeId]/complete/route";
import { GET as getEpisode } from "@/app/api/epubcast/episodes/[episodeId]/route";
import { SEGMENT_COUNT } from "@/lib/epubcast/script";

function longParagraph(seed: string, words = 140): string {
  return Array.from({ length: words }, (_, i) => `${seed}${i}`).join(" ");
}

async function upload(chapters = 3) {
  const buf = await createEpub({
    title: "Notes from Underground",
    author: "Fyodor Dostoevsky",
    chapters: Array.from({ length: chapters }, (_, i) => ({
      title: `Chapter ${i + 1}`,
      paragraphs: [longParagraph(`c${i}a`), longParagraph(`c${i}b`)],
    })),
  });
  const form = new FormData();
  form.append(
    "file",
    new File([new Uint8Array(buf)], "book.epub", { type: "application/epub+zip" }),
  );
  const res = await uploadPodcast(
    new Request("http://test/api/epubcast", { method: "POST", body: form }) as never,
  );
  return res;
}

async function episodesOf(podcastId: string) {
  const res = await getPodcast(new Request("http://test"), {
    params: { id: podcastId },
  });
  const { podcast } = await res.json();
  return podcast.episodes as {
    id: string;
    chapterIndex: number;
    status: string;
    unlocked: boolean;
    wordCount: number;
  }[];
}

beforeEach(async () => {
  await resetDb();
  await prisma.episode.deleteMany();
  await prisma.podcast.deleteMany();
  fake.fail = false;
});

describe("EpubCast upload", () => {
  it("creates one episode per chapter, with only the first unlocked", async () => {
    const res = await upload(3);
    expect(res.status).toBe(201);
    const { podcast } = await res.json();
    expect(podcast.title).toBe("Notes from Underground");
    expect(podcast.totalChapters).toBe(3);

    const episodes = await episodesOf(podcast.id);
    expect(episodes).toHaveLength(3);
    expect(episodes[0].unlocked).toBe(true);
    expect(episodes[0].status).toBe("pending");
    expect(episodes.slice(1).every((e) => !e.unlocked)).toBe(true);
    expect(episodes.slice(1).every((e) => e.status === "locked")).toBe(true);
  });

  it("rejects non-EPUB uploads", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array([1, 2])], "x.txt", { type: "text/plain" }));
    const res = await uploadPodcast(
      new Request("http://test", { method: "POST", body: form }) as never,
    );
    expect(res.status).toBe(415);
  });

  it("lists shows with recorded and unlocked counts", async () => {
    await upload(2);
    const { podcasts } = await (await listPodcasts()).json();
    expect(podcasts).toHaveLength(1);
    expect(podcasts[0].unlockedCount).toBe(1);
    expect(podcasts[0].readyCount).toBe(0);
  });
});

describe("EpubCast generation", () => {
  it("researches first, then writes one segment per step, then finishes", async () => {
    const { podcast } = await (await upload(2)).json();
    const [ep1] = await episodesOf(podcast.id);
    const params = { params: { episodeId: ep1.id } };

    // Step 1 — research.
    const first = await (await generateStep(new Request("http://t"), params)).json();
    expect(first.status).toBe("scripting");
    expect(first.done).toBe(false);
    expect(first.step).toMatch(/researched/i);

    // Steps 2..N — one segment each.
    let last = first;
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      last = await (await generateStep(new Request("http://t"), params)).json();
      expect(last.segmentsDone).toBe(i + 1);
    }
    expect(last.done).toBe(true);
    expect(last.status).toBe("ready");
    expect(last.wordCount).toBeGreaterThan(0);
    expect(last.durationSeconds).toBeGreaterThan(0);

    const stored = await prisma.episode.findUnique({ where: { id: ep1.id } });
    const turns = JSON.parse(stored!.script!);
    expect(turns).toHaveLength(SEGMENT_COUNT * 2);
    expect(turns[0].speaker).toBe("A");
  });

  it("serves the finished episode with its turns and sources", async () => {
    const { podcast } = await (await upload(1)).json();
    const [ep1] = await episodesOf(podcast.id);
    const params = { params: { episodeId: ep1.id } };
    for (let i = 0; i <= SEGMENT_COUNT; i++) {
      await generateStep(new Request("http://t"), params);
    }

    const res = await getEpisode(new Request("http://t"), params);
    expect(res.status).toBe(200);
    const { episode } = await res.json();
    expect(episode.turns.length).toBe(SEGMENT_COUNT * 2);
    expect(episode.sources[0].url).toBe("https://example.com/essay");
    expect(episode.durationSeconds).toBeGreaterThan(0);
  });

  it("refuses to generate a locked episode", async () => {
    const { podcast } = await (await upload(2)).json();
    const episodes = await episodesOf(podcast.id);
    const locked = episodes[1];
    const res = await generateStep(new Request("http://t"), {
      params: { episodeId: locked.id },
    });
    expect(res.status).toBe(403);
  });

  it("refuses to read a locked episode", async () => {
    const { podcast } = await (await upload(2)).json();
    const episodes = await episodesOf(podcast.id);
    const res = await getEpisode(new Request("http://t"), {
      params: { episodeId: episodes[1].id },
    });
    expect(res.status).toBe(403);
  });

  it("records the failure on the episode when the model errors", async () => {
    const { podcast } = await (await upload(1)).json();
    const [ep1] = await episodesOf(podcast.id);
    const params = { params: { episodeId: ep1.id } };
    await generateStep(new Request("http://t"), params); // research ok

    fake.fail = true;
    const res = await generateStep(new Request("http://t"), params);
    expect(res.status).toBe(500);

    const stored = await prisma.episode.findUnique({ where: { id: ep1.id } });
    expect(stored!.status).toBe("failed");
    expect(stored!.error).toMatch(/model unavailable/);
  });
});

describe("EpubCast chapter-by-chapter unlocking", () => {
  it("unlocks the next episode only when the current one completes", async () => {
    const { podcast } = await (await upload(3)).json();
    let episodes = await episodesOf(podcast.id);
    expect(episodes[1].unlocked).toBe(false);

    await completeEp(new Request("http://t"), {
      params: { episodeId: episodes[0].id },
    });

    episodes = await episodesOf(podcast.id);
    expect(episodes[0].unlocked).toBe(true);
    expect(episodes[1].unlocked).toBe(true);
    expect(episodes[1].status).toBe("pending");
    // The third stays locked until the second is finished.
    expect(episodes[2].unlocked).toBe(false);
  });

  it("reports no further unlock after the final episode", async () => {
    const { podcast } = await (await upload(1)).json();
    const [only] = await episodesOf(podcast.id);
    const res = await completeEp(new Request("http://t"), {
      params: { episodeId: only.id },
    });
    const body = await res.json();
    expect(body.unlockedIndex).toBeNull();
  });
});
