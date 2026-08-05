// The free EpubCast engine: composes a two-host episode from the chapter's own
// text plus keyless public research. No model, no API key, no per-episode cost.
//
// It is deterministic (same chapter → same episode) and it hits the length
// target, because the composer keeps producing beats until the word budget is
// met. Pure functions — no network, no DOM — so it is unit-testable.

import { analyzeChapter } from "@/lib/knowledge-graph";
import type { DialogueTurn } from "@/lib/epubcast/script";
import type { ResearchFact } from "@/lib/epubcast/free-research";

/** Small deterministic PRNG so an episode is stable but not repetitive. */
function makeRng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface QuoteCandidate {
  text: string;
  /** Rough position through the chapter, 0..1. */
  at: number;
}

/** Quoting a line inside speech: collapse inner double quotes to singles. */
function quoted(text: string): string {
  return `"${text.replace(/[""]/g, "'").replace(/"/g, "'").trim()}"`;
}

/** Sentences spoken aloud should start with a capital. */
function sentence(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

/**
 * Pick quotable sentences: long enough to carry meaning, short enough to read
 * aloud, and preferring lines with dialogue or concrete detail. Duplicates are
 * removed so a line is never read twice in one episode.
 */
export function pullQuotes(text: string, limit = 12): QuoteCandidate[] {
  const raw = (text.match(/[^.!?]+[.!?]+/g) || []).map((s) =>
    s.replace(/\s+/g, " ").trim(),
  );
  const total = Math.max(1, raw.length);

  const seen = new Set<string>();
  const scored = raw
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => {
      if (s.length < 60 || s.length > 240) return false;
      const key = s.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(({ s, i }) => {
      let score = 0;
      if (/["""']/.test(s)) score += 3; // dialogue
      if (/\b(I|he|she|they|we)\b/.test(s)) score += 1;
      if (/[;:,—-]/.test(s)) score += 1; // some syntactic shape
      if (s.length > 90 && s.length < 190) score += 2;
      if (/\b(never|always|nothing|everything|because|but|yet)\b/i.test(s)) score += 1;
      return { text: s, at: i / total, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit * 2);

  // Spread the picks across the chapter rather than clustering at the start.
  scored.sort((a, b) => a.at - b.at);
  const step = Math.max(1, Math.floor(scored.length / limit));
  const out: QuoteCandidate[] = [];
  for (let i = 0; i < scored.length && out.length < limit; i += step) {
    out.push({ text: scored[i].text, at: scored[i].at });
  }
  return out;
}

/** Rotating picker: exhausts the pool before any phrasing repeats. */
function cycler<T>(items: T[], rng: () => number) {
  let pool: T[] = [];
  return (): T => {
    if (!pool.length) pool = [...items].sort(() => rng() - 0.5);
    return pool.pop() as T;
  };
}

/**
 * Distinct craft observations. The pool is deliberately large: an episode is
 * ~3,600 words, so a small pool degenerates into obvious repetition.
 */
const OBSERVATIONS = [
  "What gets me is how much is withheld. The sentence tells you what happened without telling you what it meant, and it trusts you to sit in that gap.",
  "Notice the rhythm — read it aloud and you can hear exactly where the weight falls. The syntax is doing as much work as the vocabulary.",
  "There's no adjective doing the emotional lifting there. The feeling arrives through what the character does, which is much harder to write.",
  "The point of view slides in that line. For a moment you're not watching the character, you're behind their eyes, and the book never announces the shift.",
  "It's the concreteness. A lesser version of this book would tell you the mood; this one gives you an object and lets the mood come off it.",
  "The verbs are all quite plain, and that plainness is deliberate. The drama stays in the situation instead of leaking into the prose.",
  "Look at the length of that sentence against the ones around it. The variation is the pacing — it speeds up and stalls in the same paragraph.",
  "There's an irony there that the narrator never flags. The book assumes you'll catch it, which is a kind of respect for the reader.",
  "Something is being avoided in that line, and the avoidance is legible. The prose keeps looking slightly to the side of the real subject.",
  "The silence around that moment is as loaded as the speech. Nobody answers, and the non-answer is the answer.",
  "That's a sentence that could have been three sentences. Keeping it as one forces you through it at the character's pace, without a breath.",
  "The detail is oddly specific, and specificity like that usually means the book wants you to remember it later.",
  "There's a gap between what the character says and what we've just watched them do. The book puts them side by side and says nothing.",
  "The register shifts there — it goes formal at exactly the moment the feeling gets unmanageable, which is such a human thing to do.",
  "It refuses the easy image. You can feel a more sentimental sentence hovering nearby that the book declines to write.",
  "The tense does something quietly strange there, and it pulls the moment slightly out of sequence with the rest of the scene.",
  "Everything in that line is observable from outside. No interiority at all — and yet you know precisely what's happening inside.",
  "It's structured like an argument, and the character is losing it to themselves in real time.",
  "The sentence turns on a single conjunction, and everything before and after it belongs to two different people.",
  "There's a physical gesture doing the emotional work there, which is the oldest trick in fiction and still the best one.",
  "The rhythm goes flat at exactly the wrong moment, and the flatness is how you know something is being suppressed.",
  "It's written from just far enough away that you can see the character without being asked to forgive them.",
  "The comparison in that line is doing something sly — it makes the abstract thing behave like a physical one.",
  "The scene refuses to end where you expect. That extra beat afterwards is where the meaning actually lives.",
  "You can hear a speaking voice in that syntax. It's not narration so much as somebody talking themselves into something.",
  "The chapter keeps repeating that construction, and repetition at that scale is always a choice.",
  "There's a small factual detail there that quietly contradicts what the character just claimed.",
  "It gives you the consequence before the cause, and that inversion is what makes it land.",
  "The line is almost casual, which is precisely why it stings on a second read.",
  "Notice how little happens externally. The event of the scene is entirely a change in how someone understands themselves.",
];

const REACTIONS = [
  "That's a good way to put it, because it means the chapter is never really telling you what to feel.",
  "And once you see it, it's everywhere in this chapter. It stops reading like accident.",
  "Right — and that's why it survives rereading. The first pass gives you the plot, the second gives you the construction.",
  "I'd go further: that's the whole method of the book in miniature.",
  "It's also why this is hard to excerpt. Pulled out, the line looks ordinary; in place, it's doing three things at once.",
  "Which is a risk, honestly. A reader in a hurry will skim straight past it.",
  "That's the part I'd underline if I were reading this with a pencil.",
  "And it pays off later, which is the thing about this book — nothing here is decoration.",
  "You can feel the writer trusting the material instead of decorating it.",
  "That restraint is the reason the emotional moments land when they finally arrive.",
  "It's a small thing that changes how you read the rest of the scene.",
  "And it tells you the book knows exactly which detail to spend its attention on.",
  "That's the kind of line that makes you slow down without knowing why.",
  "It's understated to the point of being easy to miss, which I think is the intent.",
  "There's real confidence in leaving it at that instead of explaining it.",
  "You could teach a whole workshop off that one sentence.",
  "And it does it without ever raising its voice, which is the impressive part.",
  "That's exactly the sort of moment people mean when they call this book quietly devastating.",
  "It rewards the reader who's paying attention and doesn't punish the one who isn't.",
  "The economy of it is the achievement — nothing wasted, nothing announced.",
];

const PUSHBACK = [
  "I want to push back on that a little.",
  "I read that differently, actually.",
  "See, I'm less sure about that.",
  "Let me be the difficult one for a second.",
  "Here's where we part ways, I think.",
  "I'll take the other side of that.",
];

const THEME_FRAMES = [
  "It shows up here not as a topic the book discusses but as a pressure the characters live under, which is a harder and better way to write about it.",
  "The chapter never names it, which is exactly why it works — it's in the choices rather than the commentary.",
  "It's doing structural work here: the scene is arranged around it even when nobody mentions it.",
  "What's interesting is that it arrives through the minor details rather than the big moments.",
  "The book treats it as a condition rather than an event, and that's why it doesn't resolve.",
  "It sits underneath the dialogue — you notice it in what the characters decline to say.",
];

const THEME_COUNTERS = [
  "I'd say it's the chapter's question rather than its answer. It keeps raising it and then refusing to resolve it.",
  "To me that reads less like a theme and more like a symptom of the situation the book has set up.",
  "I think we're over-reading it slightly — some of that is just how people in this world talk.",
  "I'd put the emphasis elsewhere. That's the surface; the real pressure is coming from somewhere less obvious.",
  "It might be doing less work than we're giving it credit for, at least in this chapter.",
];

const THEME_LANDINGS = [
  "And maybe that refusal is the answer. The chapter would be smaller if it tidied that up.",
  "That's fair, and I think the ambiguity is deliberate rather than unfinished.",
  "Either way, it's the thing the chapter keeps circling, and circling is the point.",
  "I'll grant you that — it's more suggestion than argument here.",
  "Which is probably why readers come away from this book disagreeing so productively.",
];

const LEAD_INS = [
  "Here's another moment I flagged.",
  "Can I read you one more?",
  "This is the one I keep coming back to.",
  "There's a line a bit further on that does the same thing.",
  "Take this one.",
  "And then there's this.",
];

class Composer {
  turns: DialogueTurn[] = [];
  words = 0;
  private nextSpeaker: "A" | "B";

  constructor(opening: "A" | "B") {
    this.nextSpeaker = opening;
  }

  say(speaker: "A" | "B", text: string) {
    const clean = sentence(text);
    if (!clean) return;
    this.turns.push({ speaker, text: clean });
    this.words += clean.split(/\s+/).length;
    this.nextSpeaker = speaker === "A" ? "B" : "A";
  }

  next(text: string) {
    this.say(this.nextSpeaker, text);
  }
}

export interface FreeScriptInput {
  bookTitle: string;
  author: string | null;
  chapterTitle: string;
  chapterNumber: number;
  totalChapters: number;
  chapterText: string;
  facts: ResearchFact[];
  researchQuotes: { text: string; url?: string }[];
  segmentIndex: number;
  targetWords: number;
}

/**
 * Compose one segment of an episode. Segments 0-3 cover: the opening, close
 * reading, the wider conversation, and themes + close.
 */
export function composeSegment(input: FreeScriptInput): DialogueTurn[] {
  const {
    bookTitle,
    author,
    chapterTitle,
    chapterNumber,
    totalChapters,
    chapterText,
    facts,
    researchQuotes,
    segmentIndex,
    targetWords,
  } = input;

  const rng = makeRng(`${bookTitle}|${chapterNumber}|${segmentIndex}`);
  const analysis = analyzeChapter(chapterText);
  const quotes = pullQuotes(chapterText, 16);
  const entities = analysis.entities;
  const themes = analysis.themes;
  const by = author ? ` by ${author}` : "";
  const c = new Composer(segmentIndex % 2 === 0 ? "A" : "B");

  const observe = cycler(OBSERVATIONS, rng);
  const react = cycler(REACTIONS, rng);
  const pushback = cycler(PUSHBACK, rng);
  const leadIn = cycler(LEAD_INS, rng);
  const themeFrame = cycler(THEME_FRAMES, rng);
  const themeCounter = cycler(THEME_COUNTERS, rng);
  const themeLanding = cycler(THEME_LANDINGS, rng);

  // Never read the same line of the book twice in one segment.
  const usedQuotes = new Set<string>();
  const takeQuote = (): string | null => {
    for (const q of quotes) {
      if (!usedQuotes.has(q.text)) {
        usedQuotes.add(q.text);
        return q.text;
      }
    }
    return null;
  };

  // ── Segment 0: cold open and orientation ────────────────────────────────
  if (segmentIndex === 0) {
    c.say(
      "A",
      `Welcome back to EpubCast. I'm Nora, and today we're on chapter ${chapterNumber} of ${bookTitle}${by} — "${chapterTitle}".`,
    );
    c.say(
      "B",
      `And I'm Julian. Chapter ${chapterNumber} of ${totalChapters}. I came out of this one with more questions than I went in with, which I think is a compliment.`,
    );
    c.say(
      "A",
      `Let's set the table. This chapter runs about ${analysis.wordCount.toLocaleString()} words${
        entities.length ? `, and it turns on ${entities.slice(0, 3).join(", ")}` : ""
      }. Here's the shape of it, in the book's own words.`,
    );
    const seenSummary = new Set<string>();
    for (const s of analysis.summary.slice(0, 3)) {
      if (seenSummary.has(s)) continue;
      seenSummary.add(s);
      usedQuotes.add(s);
      c.next(quoted(s));
      c.next(react());
    }
    if (entities.length) {
      c.next(
        `The names doing the most work here are ${entities.slice(0, 4).join(", ")}. ${
          entities.length > 2
            ? "The chapter keeps putting them in the same rooms, and that pairing carries a lot of the argument."
            : "The chapter narrows hard onto that, and the narrowness is the point."
        }`,
      );
    }
    if (themes.length) {
      c.next(
        `And thematically it keeps returning to ${themes.slice(0, 4).join(", ")} — those words recur often enough that it stops being coincidence.`,
      );
    }
    c.next(
      `What struck me on a first read was the pacing. It doesn't rush to explain itself, and I think a lot of readers bounce off exactly there.`,
    );
  }

  // ── Segment 1: close reading ────────────────────────────────────────────
  if (segmentIndex === 1) {
    c.next(
      `Let's get properly into the text, because this chapter rewards slowing down. I want to read you a line.`,
    );
    let n = 0;
    while (c.words < targetWords * 0.9) {
      const quote = takeQuote();
      if (!quote) break;
      c.next(quoted(quote));
      c.next(observe());
      c.next(react());
      n += 1;
      if (n % 3 === 0) {
        c.next(pushback());
        c.next(
          `I don't think that's a trick of style so much as a decision about attention — the prose keeps looking at the thing everyone in the scene is trying not to look at.`,
        );
      }
    }
  }

  // ── Segment 2: the wider conversation ───────────────────────────────────
  if (segmentIndex === 2) {
    c.next(
      `Let's widen out, because this book doesn't sit in a vacuum — people have been arguing about it for a long time.`,
    );
    if (!facts.length) {
      c.next(
        `Fair warning: we didn't turn up much published commentary on this specific book, so rather than pretend otherwise we'll stay close to the text and to the tradition it's working in.`,
      );
    }
    for (const f of facts) {
      if (c.words > targetWords * 0.7) break;
      c.next(`One thing worth knowing: ${f.text}`);
      c.next(
        `That reframes the chapter a bit — it tells you what the book was pushing against when it was written.`,
      );
    }
    for (const rq of researchQuotes.slice(0, 3)) {
      if (c.words > targetWords * 0.85) break;
      c.next(`There's a line people quote from this book a lot: ${quoted(rq.text)}`);
      c.next(
        `And you can feel the same instinct in this chapter, even where the language is quieter.`,
      );
    }
    if (themes.length) {
      c.next(
        `The other reason it keeps coming up in conversation is ${themes[0]} — that's the argument readers take away from it, and it's usually where the disagreement starts.`,
      );
    }
  }

  // ── Segment 3: themes and disagreement (sign-off added after the fill) ──
  if (segmentIndex === 3) {
    c.next(
      `Alright — let's try to say what this chapter is actually for, and I suspect we won't fully agree.`,
    );
    const themeList = themes.length ? themes : ["memory", "consequence"];
    for (const t of themeList) {
      if (c.words > targetWords * 0.65) break;
      c.next(`Take "${t}". ${themeFrame()}`);
      c.next(`${pushback()} On "${t}" specifically — ${themeCounter()}`);
      c.next(themeLanding());
    }
  }

  // ── Fill to the word budget with fresh close-reading beats ─────────────
  // Runs before any sign-off, so the episode never keeps talking after goodbye.
  let guard = 0;
  while (c.words < targetWords && guard < 80) {
    guard += 1;
    const quote = takeQuote();
    if (quote) {
      c.next(`${leadIn()} ${quoted(quote)}`);
      c.next(observe());
      // Only sometimes add a stock reaction, so the pool stretches further.
      if (guard % 2 === 0 && c.words < targetWords) c.next(react());
    } else if (themes.length) {
      const t = themes[guard % themes.length];
      // Themes are single words pulled from the text, so quote them to keep
      // the sentence grammatical whatever the word turns out to be.
      c.next(`Come back to that word for a second — "${t}". ${themeFrame()}`);
      c.next(observe());
    } else {
      c.next(observe());
      c.next(react());
    }
  }

  // ── Sign-off, always the last thing said in the final segment ───────────
  if (segmentIndex === 3) {
    const closer = quotes.length ? quotes[quotes.length - 1].text : null;
    if (closer) {
      c.next(`I want to end on a line. ${quoted(closer)}`);
      c.next(
        `That's the one I'll be carrying into the next chapter. It reads like a door left deliberately open.`,
      );
    }
    c.say(
      "A",
      `That's chapter ${chapterNumber} of ${bookTitle}. ${
        chapterNumber < totalChapters
          ? `Next time we pick up chapter ${chapterNumber + 1} — and I suspect this chapter's unfinished business comes due.`
          : `That's the last of it, and it has been a genuine pleasure reading this one out loud.`
      }`,
    );
    c.say("B", `Read ahead if you can't wait. See you next episode.`);
  }

  return c.turns;
}
