import { prisma } from "@/lib/prisma";
import { handle, json, error } from "@/lib/api";
import { hasApiKey } from "@/lib/epubcast/generate";
import { estimateSeconds } from "@/lib/epubcast/script";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// GET /api/epubcast/:id — a podcast and its episode list (no script bodies).
export async function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const podcast = await prisma.podcast.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        author: true,
        cover: true,
        totalChapters: true,
        createdAt: true,
        episodes: {
          orderBy: { chapterIndex: "asc" },
          select: {
            id: true,
            chapterIndex: true,
            chapterTitle: true,
            status: true,
            unlocked: true,
            listened: true,
            segmentsDone: true,
            segmentsTotal: true,
            wordCount: true,
            error: true,
          },
        },
      },
    });
    if (!podcast) return error("Podcast not found.", 404);

    return json({
      apiKeyConfigured: hasApiKey(),
      podcast: {
        ...podcast,
        episodes: podcast.episodes.map((e) => ({
          ...e,
          durationSeconds: estimateSeconds(e.wordCount),
        })),
      },
    });
  });
}

// DELETE /api/epubcast/:id — remove a podcast and its episodes.
export async function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const existing = await prisma.podcast.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!existing) return error("Podcast not found.", 404);
    await prisma.podcast.delete({ where: { id: params.id } });
    return json({ ok: true });
  });
}
