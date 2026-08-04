import { prisma } from "@/lib/prisma";
import {
  generateSegment,
  researchChapter,
  MissingApiKeyError,
} from "@/lib/epubcast/generate";
import { activeEngine } from "@/lib/epubcast/engine";
import { freeResearch, type ResearchFact } from "@/lib/epubcast/free-research";
import { composeSegment } from "@/lib/epubcast/free-script";
import {
  SEGMENT_COUNT,
  WORDS_PER_SEGMENT,
  countWords,
  estimateSeconds,
  parseDialogue,
  type DialogueTurn,
  type Research,
} from "@/lib/epubcast/script";

/** Research plus the extra material the free composer uses. */
type StoredResearch = Research & {
  facts: ResearchFact[];
  quotes: { text: string; url?: string }[];
};

export interface StepResult {
  status: string;
  segmentsDone: number;
  segmentsTotal: number;
  /** True once the whole episode is written. */
  done: boolean;
  /** Human-readable description of the step just completed. */
  step: string;
  wordCount: number;
  durationSeconds: number;
}

function readScript(raw: string | null): DialogueTurn[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DialogueTurn[]) : [];
  } catch {
    return [];
  }
}

function readResearch(raw: string | null): StoredResearch {
  const empty: StoredResearch = { brief: "", sources: [], facts: [], quotes: [] };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw);
    return {
      brief: typeof parsed?.brief === "string" ? parsed.brief : "",
      sources: Array.isArray(parsed?.sources) ? parsed.sources : [],
      facts: Array.isArray(parsed?.facts) ? parsed.facts : [],
      quotes: Array.isArray(parsed?.quotes) ? parsed.quotes : [],
    };
  } catch {
    return empty;
  }
}

export class EpisodeLockedError extends Error {
  constructor() {
    super("Finish the previous episode to unlock this one.");
    this.name = "EpisodeLockedError";
  }
}

/**
 * Advance one episode by a single generation step — the research pass, or one
 * dialogue segment. Keeping each call to one model turn means every HTTP
 * request finishes quickly; the client calls this repeatedly until `done`.
 */
export async function advanceEpisode(episodeId: string): Promise<StepResult> {
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      podcast: { select: { title: true, author: true, totalChapters: true } },
    },
  });
  if (!episode) throw new Error("Episode not found.");
  if (!episode.unlocked) throw new EpisodeLockedError();

  const turns = readScript(episode.script);

  try {
    // Step 1 — research the chapter's wider conversation.
    if (!episode.research) {
      await prisma.episode.update({
        where: { id: episodeId },
        data: { status: "researching", error: null },
      });
      const research =
        activeEngine() === "free"
          ? await freeResearch({
              bookTitle: episode.podcast.title,
              author: episode.podcast.author,
              chapterTitle: episode.chapterTitle,
            })
          : await researchChapter({
              bookTitle: episode.podcast.title,
              author: episode.podcast.author,
              chapterTitle: episode.chapterTitle,
              chapterText: episode.chapterText,
            });
      await prisma.episode.update({
        where: { id: episodeId },
        data: {
          research: JSON.stringify(research),
          status: "scripting",
        },
      });
      return {
        status: "scripting",
        segmentsDone: 0,
        segmentsTotal: episode.segmentsTotal,
        done: false,
        step: `Researched the conversation around this chapter (${research.sources.length} sources)`,
        wordCount: 0,
        durationSeconds: 0,
      };
    }

    // Step 2..N — write one dialogue segment.
    if (episode.segmentsDone < episode.segmentsTotal) {
      await prisma.episode.update({
        where: { id: episodeId },
        data: { status: "scripting", error: null },
      });

      const research = readResearch(episode.research);
      const fresh =
        activeEngine() === "free"
          ? composeSegment({
              bookTitle: episode.podcast.title,
              author: episode.podcast.author,
              chapterTitle: episode.chapterTitle,
              chapterNumber: episode.chapterIndex + 1,
              totalChapters: episode.podcast.totalChapters,
              chapterText: episode.chapterText,
              facts: research.facts,
              researchQuotes: research.quotes,
              segmentIndex: episode.segmentsDone,
              targetWords: WORDS_PER_SEGMENT,
            })
          : await generateSegment({
              bookTitle: episode.podcast.title,
              author: episode.podcast.author,
              chapterTitle: episode.chapterTitle,
              chapterNumber: episode.chapterIndex + 1,
              chapterText: episode.chapterText,
              research,
              segmentIndex: episode.segmentsDone,
              previousTurns: turns,
            });

      if (!fresh.length) {
        throw new Error("The model returned no usable dialogue for this segment.");
      }

      const merged = [...turns, ...fresh];
      const segmentsDone = episode.segmentsDone + 1;
      const complete = segmentsDone >= episode.segmentsTotal;
      const wordCount = countWords(merged);

      await prisma.episode.update({
        where: { id: episodeId },
        data: {
          script: JSON.stringify(merged),
          segmentsDone,
          wordCount,
          status: complete ? "ready" : "scripting",
        },
      });

      return {
        status: complete ? "ready" : "scripting",
        segmentsDone,
        segmentsTotal: episode.segmentsTotal,
        done: complete,
        step: complete
          ? "Episode complete"
          : `Wrote segment ${segmentsDone} of ${episode.segmentsTotal}`,
        wordCount,
        durationSeconds: estimateSeconds(wordCount),
      };
    }

    // Already finished.
    const wordCount = countWords(turns);
    if (episode.status !== "ready") {
      await prisma.episode.update({
        where: { id: episodeId },
        data: { status: "ready", wordCount },
      });
    }
    return {
      status: "ready",
      segmentsDone: episode.segmentsDone,
      segmentsTotal: episode.segmentsTotal,
      done: true,
      step: "Episode complete",
      wordCount,
      durationSeconds: estimateSeconds(wordCount),
    };
  } catch (err) {
    const message =
      err instanceof MissingApiKeyError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Generation failed.";
    await prisma.episode.update({
      where: { id: episodeId },
      data: { status: "failed", error: message.slice(0, 500) },
    });
    throw err;
  }
}

/**
 * Mark an episode listened and unlock the next one — the chapter-by-chapter
 * progression. Returns the newly unlocked chapter index, if any.
 */
export async function completeEpisode(
  episodeId: string,
): Promise<{ unlockedIndex: number | null }> {
  const episode = await prisma.episode.findUnique({ where: { id: episodeId } });
  if (!episode) throw new Error("Episode not found.");

  await prisma.episode.update({
    where: { id: episodeId },
    data: { listened: true },
  });

  const next = await prisma.episode.findUnique({
    where: {
      podcastId_chapterIndex: {
        podcastId: episode.podcastId,
        chapterIndex: episode.chapterIndex + 1,
      },
    },
  });
  if (!next) return { unlockedIndex: null };

  if (!next.unlocked) {
    await prisma.episode.update({
      where: { id: next.id },
      data: { unlocked: true, status: "pending" },
    });
  }
  return { unlockedIndex: next.chapterIndex };
}

export { parseDialogue, SEGMENT_COUNT };
