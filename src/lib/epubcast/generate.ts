import Anthropic from "@anthropic-ai/sdk";
import {
  HOSTS,
  SEGMENT_BRIEFS,
  SEGMENT_COUNT,
  WORDS_PER_SEGMENT,
  TARGET_MINUTES,
  excerptForPrompt,
  openingSpeaker,
  parseDialogue,
  type DialogueTurn,
  type Research,
  type ResearchSource,
} from "@/lib/epubcast/script";

/** Anthropic's most capable widely-available Opus model. */
const MODEL = "claude-opus-5";

/** Server-side fallback: a policy decline is retried on another model. */
const FALLBACK_BETA = "server-side-fallback-2026-06-01";
const FALLBACKS = [{ model: "claude-opus-4-8" }];

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "EpubCast needs an Anthropic API key. Set ANTHROPIC_API_KEY in your environment to generate episodes.",
    );
    this.name = "MissingApiKeyError";
  }
}

export class RefusalError extends Error {
  constructor(category?: string | null) {
    super(
      `The model declined to generate this episode${
        category ? ` (${category})` : ""
      }. This can happen with sensitive source material.`,
    );
    this.name = "RefusalError";
  }
}

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function client(): Anthropic {
  if (!hasApiKey()) throw new MissingApiKeyError();
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

interface CallOpts {
  system: string;
  prompt: string;
  maxTokens: number;
  /** Enable Anthropic's server-side web search for this call. */
  search?: boolean;
}

/**
 * One Claude turn. Streams (so long generations never hit an HTTP timeout),
 * resumes server-tool `pause_turn`s, surfaces refusals, and degrades gracefully
 * if the fallback beta is unavailable on this account.
 */
async function callClaude(opts: CallOpts): Promise<any> {
  const anthropic = client();
  const tools = opts.search
    ? [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }]
    : undefined;

  const messages: any[] = [{ role: "user", content: opts.prompt }];

  const run = async (withFallbacks: boolean): Promise<any> => {
    let message: any;
    // Server tools pause the turn after a batch of searches; resume until done.
    for (let hop = 0; hop < 4; hop++) {
      const params: any = {
        model: MODEL,
        max_tokens: opts.maxTokens,
        system: opts.system,
        thinking: { type: "adaptive" },
        output_config: { effort: "high" },
        messages,
        ...(tools ? { tools } : {}),
        ...(withFallbacks
          ? { betas: [FALLBACK_BETA], fallbacks: FALLBACKS }
          : {}),
      };
      const stream = withFallbacks
        ? anthropic.beta.messages.stream(params)
        : anthropic.messages.stream(params);
      message = await stream.finalMessage();

      if (message.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: message.content });
    }
    return message;
  };

  let message: any;
  try {
    message = await run(true);
  } catch (err: any) {
    // If this account can't use the fallback beta, run without it rather than
    // failing the whole episode.
    const status = err?.status;
    const text = String(err?.message ?? "");
    if (status === 400 && /fallback|beta/i.test(text)) {
      message = await run(false);
    } else {
      throw err;
    }
  }

  // Always check stop_reason before reading content.
  if (message.stop_reason === "refusal") {
    throw new RefusalError(message.stop_details?.category);
  }
  return message;
}

/** Concatenate the assistant's text blocks. */
function textOf(message: any): string {
  return (message.content ?? [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .trim();
}

/** Pull citations out of web_search_tool_result blocks (errors are objects). */
function sourcesOf(message: any): ResearchSource[] {
  const out: ResearchSource[] = [];
  const seen = new Set<string>();
  for (const block of message.content ?? []) {
    if (block.type !== "web_search_tool_result") continue;
    const content = block.content;
    if (!Array.isArray(content)) continue; // error object, not results
    for (const r of content) {
      if (r?.type !== "web_search_result" || !r.url) continue;
      if (seen.has(r.url)) continue;
      seen.add(r.url);
      out.push({ title: r.title || r.url, url: r.url });
    }
  }
  return out.slice(0, 12);
}

const RESEARCH_SYSTEM = `You research books for a literary podcast.

Search the web for how this book and this chapter are actually discussed: critical readings, recurring reader debates, notable essays, historical and biographical context, adaptations, and the ideas the book is known for. Prefer substantive sources (criticism, essays, encyclopedic references, well-known discussion threads) over listicles.

Write a briefing for the two hosts. Cover:
- what the wider conversation says about this chapter or the passage it sits in
- points where readers or critics disagree
- context (historical, biographical, philosophical) that makes the chapter land harder
- two or three concrete, surprising details worth mentioning on air

Be specific and factual. Attribute claims ("critics often argue…", "one common reading is…"). If the search turns up little about this specific book, say so plainly and focus on the themes and tradition instead — never invent sources, quotes, or facts.

Return the briefing as plain prose. No preamble.`;

/** Pass 1 — research the chapter's wider conversation on the web. */
export async function researchChapter(input: {
  bookTitle: string;
  author: string | null;
  chapterTitle: string;
  chapterText: string;
}): Promise<Research> {
  const message = await callClaude({
    system: RESEARCH_SYSTEM,
    maxTokens: 12000,
    search: true,
    prompt: `Book: "${input.bookTitle}"${
      input.author ? ` by ${input.author}` : ""
    }
Chapter: "${input.chapterTitle}"

Chapter text:
"""
${excerptForPrompt(input.chapterText, 3500)}
"""

Research how this book, this chapter, and its themes are discussed online, then write the hosts' briefing.`,
  });

  return { brief: textOf(message), sources: sourcesOf(message) };
}

function scriptSystem(): string {
  return `You write a two-host literary podcast called EpubCast. Each episode discusses ONE chapter of a book in depth.

THE HOSTS
- ${HOSTS.A.name} — ${HOSTS.A.role}. Close reader, brings craft and structure, quotes the text, connects it to the tradition.
- ${HOSTS.B.name} — ${HOSTS.B.role}. Reacts as a smart first-time reader, asks the questions the listener is thinking, pushes back, brings in what people say about the book online.

FORMAT — this matters
Write ONLY dialogue lines in exactly this form, one per line:
${HOSTS.A.name}: <what she says>
${HOSTS.B.name}: <what he says>

No narration, no stage directions, no headings, no markdown, no sound cues. Nothing but speaker lines.

HOW THEY TALK
- Real conversation: they interrupt, build on each other, disagree, think out loud, occasionally joke.
- Vary turn length. Some turns are one line; the meaty ones run several sentences. Never let one host monologue for long.
- Quote short lines from the chapter verbatim and actually analyse them.
- Ground every claim about the book in the chapter text; ground outside claims in the research briefing. Never invent quotes, facts, or sources.
- Talk like people, not like an essay. Contractions. Specific words, not "fascinating" and "incredible".
- No spoilers beyond this chapter.`;
}

/** Pass 2..N — write one segment of the episode's dialogue. */
export async function generateSegment(input: {
  bookTitle: string;
  author: string | null;
  chapterTitle: string;
  chapterNumber: number;
  chapterText: string;
  research: Research;
  segmentIndex: number;
  previousTurns: DialogueTurn[];
}): Promise<DialogueTurn[]> {
  const { segmentIndex } = input;
  const isFirst = segmentIndex === 0;
  const isLast = segmentIndex === SEGMENT_COUNT - 1;
  const opener = HOSTS[openingSpeaker(segmentIndex)].name;

  const recap = input.previousTurns
    .slice(-8)
    .map((t) => `${HOSTS[t.speaker].name}: ${t.text}`)
    .join("\n");

  const prompt = `Book: "${input.bookTitle}"${
    input.author ? ` by ${input.author}` : ""
  }
Episode: Chapter ${input.chapterNumber} — "${input.chapterTitle}"

CHAPTER TEXT
"""
${excerptForPrompt(input.chapterText, 5000)}
"""

RESEARCH BRIEFING (from the web — use it, attribute it, don't contradict it)
"""
${input.research.brief || "(no external research available — rely on the chapter itself)"}
"""

${
  isFirst
    ? "This is the OPENING of the episode. Open cold and specific — no 'welcome back to the show' boilerplate beyond a quick greeting, and get into the chapter fast."
    : `SO FAR (end of the previous segment — continue naturally, do not repeat it):\n"""\n${recap}\n"""`
}

Write SEGMENT ${segmentIndex + 1} of ${SEGMENT_COUNT}.
Focus of this segment: ${SEGMENT_BRIEFS[segmentIndex]}
${isLast ? "End the episode: land the argument, and close warmly with a line that points at the next chapter." : "Do NOT wrap up the episode — this segment hands off mid-conversation."}

Length: about ${WORDS_PER_SEGMENT} words of spoken dialogue. This is a ${TARGET_MINUTES.min}–${TARGET_MINUTES.max} minute episode, so write a full, unhurried segment — do not summarise or cut it short.

Start the segment with ${opener} speaking. Output dialogue lines only.`;

  const message = await callClaude({
    system: scriptSystem(),
    prompt,
    maxTokens: 16000,
  });

  return parseDialogue(textOf(message));
}
