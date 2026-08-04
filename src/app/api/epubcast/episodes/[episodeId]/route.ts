import { prisma } from "@/lib/prisma";
import { handle, json, error } from "@/lib/api";
import { estimateSeconds, type DialogueTurn } from "@/lib/epubcast/script";

export const dynamic = "force-dynamic";

type Params = { params: { episodeId: string } };

// GET /api/epubcast/episodes/:episodeId — the full episode, with its script.
export async function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const episode = await prisma.episode.findUnique({
      where: { id: params.episodeId },
      select: {
        id: true,
        podcastId: true,
        chapterIndex: true,
        chapterTitle: true,
        status: true,
        unlocked: true,
        listened: true,
        segmentsDone: true,
        segmentsTotal: true,
        wordCount: true,
        script: true,
        research: true,
        error: true,
        podcast: { select: { title: true, author: true, cover: true } },
      },
    });
    if (!episode) return error("Episode not found.", 404);
    if (!episode.unlocked) {
      return error("This episode is still locked.", 403);
    }

    let turns: DialogueTurn[] = [];
    try {
      const parsed = JSON.parse(episode.script || "[]");
      if (Array.isArray(parsed)) turns = parsed;
    } catch {
      turns = [];
    }

    let sources: { title: string; url: string }[] = [];
    try {
      const parsed = JSON.parse(episode.research || "{}");
      if (Array.isArray(parsed?.sources)) sources = parsed.sources;
    } catch {
      sources = [];
    }

    const { script: _script, research: _research, ...rest } = episode;
    return json({
      episode: {
        ...rest,
        turns,
        sources,
        durationSeconds: estimateSeconds(episode.wordCount),
      },
    });
  });
}
