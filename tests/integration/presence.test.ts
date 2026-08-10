import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: async () => null }));

import { prisma } from "@/lib/prisma";
import { GET as getPresence, POST as beat } from "@/app/api/presence/route";
import { LIVE_WINDOW_MS, PRUNE_AFTER_MS, aliasFor } from "@/lib/presence";

function heartbeat(body: unknown) {
  return beat(
    new Request("http://test/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
  );
}

beforeEach(async () => {
  await prisma.presence.deleteMany();
});

describe("presence heartbeat", () => {
  it("counts each distinct visitor once, however often they check in", async () => {
    await heartbeat({ token: "visitor-one-aaaa" });
    await heartbeat({ token: "visitor-two-bbbb" });
    // The same visitor beating repeatedly must not inflate the count.
    await heartbeat({ token: "visitor-one-aaaa" });
    await heartbeat({ token: "visitor-one-aaaa" });

    const { count } = await (await getPresence()).json();
    expect(count).toBe(2);
    expect(await prisma.presence.count()).toBe(2);
  });

  it("reports the real number — 12 visitors means 12", async () => {
    for (let i = 0; i < 12; i++) {
      await heartbeat({ token: `visitor-${String(i).padStart(4, "0")}` });
    }
    const { count } = await (await getPresence()).json();
    expect(count).toBe(12);
  });

  it("drops visitors whose last heartbeat is outside the live window", async () => {
    await heartbeat({ token: "fresh-visitor-aaa" });
    await heartbeat({ token: "stale-visitor-bbb" });
    await prisma.presence.update({
      where: { token: "stale-visitor-bbb" },
      data: { lastSeen: new Date(Date.now() - LIVE_WINDOW_MS - 5_000) },
    });

    const { count, readers } = await (await getPresence()).json();
    expect(count).toBe(1);
    expect(readers.map((r: { alias: string }) => r.alias)).not.toContain(
      aliasFor("stale-visitor-bbb"),
    );
  });

  it("records who is reading what, and excludes you from your own feed", async () => {
    await heartbeat({
      token: "reader-one-aaaa",
      activity: "reading",
      bookTitle: "Crime and Punishment",
    });
    const res = await heartbeat({ token: "browser-two-bbb" });
    const body = await res.json();

    expect(body.count).toBe(2);
    expect(body.you).toBe(aliasFor("browser-two-bbb"));
    const aliases = body.readers.map((r: { alias: string }) => r.alias);
    expect(aliases).toContain(aliasFor("reader-one-aaaa"));
    expect(aliases).not.toContain(body.you);

    const reader = body.readers.find(
      (r: { alias: string }) => r.alias === aliasFor("reader-one-aaaa"),
    );
    expect(reader.activity).toBe("reading");
    expect(reader.bookTitle).toBe("Crime and Punishment");
  });

  it("only keeps a book title when the visitor is in a book", async () => {
    const res = await heartbeat({
      token: "browsing-visitor-x",
      activity: "browsing",
      bookTitle: "Something They Are Not Reading",
    });
    const { you } = await res.json();
    expect(you).toBeTruthy();
    const row = await prisma.presence.findUnique({
      where: { token: "browsing-visitor-x" },
    });
    expect(row!.bookTitle).toBeNull();
  });

  it("falls back to browsing for an unknown activity", async () => {
    await heartbeat({ token: "weird-activity-vis", activity: "mining-crypto" });
    const row = await prisma.presence.findUnique({
      where: { token: "weird-activity-vis" },
    });
    expect(row!.activity).toBe("browsing");
  });

  it("truncates an overlong book title instead of storing it whole", async () => {
    await heartbeat({
      token: "long-title-visitor",
      activity: "reading",
      bookTitle: "T".repeat(500),
    });
    const row = await prisma.presence.findUnique({
      where: { token: "long-title-visitor" },
    });
    expect(row!.bookTitle!.length).toBe(120);
  });

  it("rejects a missing or implausible token", async () => {
    expect((await heartbeat({})).status).toBe(400);
    expect((await heartbeat({ token: "short" })).status).toBe(400);
    expect((await heartbeat({ token: "x".repeat(65) })).status).toBe(400);
  });

  it("prunes rows that are long gone", async () => {
    await heartbeat({ token: "ancient-visitor-aa" });
    await prisma.presence.update({
      where: { token: "ancient-visitor-aa" },
      data: { lastSeen: new Date(Date.now() - PRUNE_AFTER_MS - 60_000) },
    });

    // Any later heartbeat triggers the opportunistic cleanup.
    await heartbeat({ token: "current-visitor-bb" });
    expect(
      await prisma.presence.findUnique({ where: { token: "ancient-visitor-aa" } }),
    ).toBeNull();
  });

  it("reports an empty room as zero rather than guessing", async () => {
    const { count, readers } = await (await getPresence()).json();
    expect(count).toBe(0);
    expect(readers).toEqual([]);
  });
});
