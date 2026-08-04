import { handle, json, error } from "@/lib/api";
import {
  advanceEpisode,
  EpisodeLockedError,
} from "@/lib/epubcast/orchestrator";
import { MissingApiKeyError, RefusalError } from "@/lib/epubcast/generate";

export const dynamic = "force-dynamic";
/** One model turn per request; give it room on hosts that allow it. */
export const maxDuration = 300;

type Params = { params: { episodeId: string } };

// POST /api/epubcast/episodes/:episodeId/generate
// Advances generation by exactly one step (research, or one dialogue segment)
// so no single request runs long. Call repeatedly until `done` is true.
export async function POST(_req: Request, { params }: Params) {
  return handle(async () => {
    try {
      const result = await advanceEpisode(params.episodeId);
      return json(result);
    } catch (err) {
      if (err instanceof MissingApiKeyError) return error(err.message, 503);
      if (err instanceof EpisodeLockedError) return error(err.message, 403);
      if (err instanceof RefusalError) return error(err.message, 422);
      throw err;
    }
  });
}
