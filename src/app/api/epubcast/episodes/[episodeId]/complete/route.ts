import { handle, json } from "@/lib/api";
import { completeEpisode } from "@/lib/epubcast/orchestrator";

export const dynamic = "force-dynamic";

type Params = { params: { episodeId: string } };

// POST /api/epubcast/episodes/:episodeId/complete
// Marks the episode listened and unlocks the next chapter.
export async function POST(_req: Request, { params }: Params) {
  return handle(async () => {
    const { unlockedIndex } = await completeEpisode(params.episodeId);
    return json({ ok: true, unlockedIndex });
  });
}
