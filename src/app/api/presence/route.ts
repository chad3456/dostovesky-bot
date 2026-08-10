import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, json, error } from "@/lib/api";
import {
  LIVE_WINDOW_MS,
  PRUNE_AFTER_MS,
  aliasFor,
  isActivity,
  type Activity,
} from "@/lib/presence";

export const dynamic = "force-dynamic";

/** Cap what we echo back so a busy site doesn't ship a huge payload. */
const MAX_READERS = 25;

interface Body {
  token?: unknown;
  activity?: unknown;
  bookTitle?: unknown;
}

async function liveSnapshot(excludeToken?: string) {
  const since = new Date(Date.now() - LIVE_WINDOW_MS);
  const rows = await prisma.presence.findMany({
    where: { lastSeen: { gte: since } },
    orderBy: { lastSeen: "desc" },
    select: { token: true, alias: true, activity: true, bookTitle: true },
    take: 200,
  });

  return {
    // The real number of live visitors — never padded.
    count: rows.length,
    readers: rows
      .filter((r) => r.token !== excludeToken)
      .slice(0, MAX_READERS)
      .map((r) => ({
        alias: r.alias,
        activity: r.activity as Activity,
        bookTitle: r.bookTitle,
      })),
  };
}

// GET /api/presence — read the live count without checking in.
export async function GET() {
  return handle(async () => json(await liveSnapshot()));
}

// POST /api/presence — heartbeat: check in and get the current snapshot back.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = (await req.json().catch(() => null)) as Body | null;
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token || token.length < 8 || token.length > 64) {
      return error("A presence token of 8-64 characters is required.", 400);
    }

    const activity: Activity = isActivity(body?.activity)
      ? body.activity
      : "browsing";
    const rawTitle =
      typeof body?.bookTitle === "string" ? body.bookTitle.trim() : "";
    // Only carry a title when the visitor is actually in a book.
    const bookTitle =
      rawTitle && (activity === "reading" || activity === "listening")
        ? rawTitle.slice(0, 120)
        : null;

    const alias = aliasFor(token);
    const now = new Date();

    await prisma.presence.upsert({
      where: { token },
      update: { activity, bookTitle, lastSeen: now, alias },
      create: { token, alias, activity, bookTitle, lastSeen: now },
    });

    // Opportunistic cleanup so the table stays small; failure is harmless.
    await prisma.presence
      .deleteMany({
        where: { lastSeen: { lt: new Date(Date.now() - PRUNE_AFTER_MS) } },
      })
      .catch(() => undefined);

    const snapshot = await liveSnapshot(token);
    return json({ ...snapshot, you: alias });
  });
}
