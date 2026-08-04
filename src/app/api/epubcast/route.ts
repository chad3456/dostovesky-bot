import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, json, error } from "@/lib/api";
import { parseEpubMetadata, extractEpubChapters } from "@/lib/epub";
import { saveBookFile } from "@/lib/storage";
import { activeEngine } from "@/lib/epubcast/engine";
import { SEGMENT_COUNT } from "@/lib/epubcast/script";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
/** Cap chapters per upload so one book can't create hundreds of episodes. */
const MAX_EPISODES = 60;

// GET /api/epubcast — every generated podcast, newest first.
export async function GET() {
  return handle(async () => {
    const podcasts = await prisma.podcast.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        author: true,
        cover: true,
        totalChapters: true,
        createdAt: true,
        episodes: {
          select: { status: true, unlocked: true, listened: true },
        },
      },
    });
    return json({
      engine: activeEngine(),
      podcasts: podcasts.map(({ episodes, ...p }) => ({
        ...p,
        readyCount: episodes.filter((e) => e.status === "ready").length,
        unlockedCount: episodes.filter((e) => e.unlocked).length,
      })),
    });
  });
}

// POST /api/epubcast — upload an EPUB and set up its episode list.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const form = await req.formData().catch(() => null);
    if (!form) return error("Expected a multipart/form-data upload.", 400);

    const file = form.get("file");
    if (!(file instanceof File)) return error("Missing 'file' field.", 400);

    const lower = file.name.toLowerCase();
    const looksEpub =
      lower.endsWith(".epub") ||
      file.type === "application/epub+zip" ||
      file.type === "application/zip";
    if (!looksEpub) return error("Only .epub files are supported.", 415);
    if (file.size === 0) return error("That file is empty.", 400);
    if (file.size > MAX_FILE_BYTES) return error("File too large (max 50MB).", 413);

    const buffer = Buffer.from(await file.arrayBuffer());

    let meta;
    let chapters;
    try {
      meta = await parseEpubMetadata(buffer);
      chapters = await extractEpubChapters(buffer);
    } catch (e) {
      return error(e instanceof Error ? e.message : "Could not read that EPUB.", 422);
    }

    const usable = chapters.slice(0, MAX_EPISODES);
    const filePath = await saveBookFile(buffer);

    const podcast = await prisma.podcast.create({
      data: {
        title: meta.title,
        author: meta.author,
        cover: meta.cover,
        filePath,
        totalChapters: usable.length,
        episodes: {
          create: usable.map((c, i) => ({
            chapterIndex: i,
            chapterTitle: c.title,
            chapterText: c.text,
            segmentsTotal: SEGMENT_COUNT,
            // Chapter one is open from the start; the rest unlock in order.
            unlocked: i === 0,
            status: i === 0 ? "pending" : "locked",
          })),
        },
      },
      select: { id: true, title: true, author: true, totalChapters: true },
    });

    return json({ podcast, engine: activeEngine() }, { status: 201 });
  });
}
