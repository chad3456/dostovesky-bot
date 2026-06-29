// Lightweight, deterministic "knowledge graph" for a chapter of prose.
//
// No LLM/API: we extract entities (proper-noun phrases) and salient theme words,
// then connect concepts that co-occur in the same sentence. The result is a
// concept map that surfaces the chapter's main people/ideas and how they relate,
// plus an extractive summary ("the sense of the chapter"). All pure + testable.

const STOPWORDS = new Set(
  (
    "the a an and or but if then else when while of to in on at by for with " +
    "from into over under again further once here there all any both each few " +
    "more most other some such no nor not only own same so than too very can " +
    "will just don should now i me my we our you your he him his she her it its " +
    "they them their this that these those am is are was were be been being have " +
    "has had do does did doing would could shall may might must about against " +
    "between through during before after above below up down out off as because " +
    "until upon among whom whose which who what where why how said say says one " +
    "two like came come go went upon yet still even ever never thus hence " +
    "mr mrs dr st"
  ).split(/\s+/),
);

export interface GraphNode {
  id: string;
  label: string;
  weight: number;
  kind: "entity" | "theme";
}
export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}
export interface ChapterAnalysis {
  nodes: GraphNode[];
  edges: GraphEdge[];
  summary: string[];
  themes: string[];
  entities: string[];
  wordCount: number;
}

interface Concept {
  key: string;
  label: string;
  count: number;
  sentences: Set<number>;
  proper: boolean;
}

const MAX_WORDS = 6000; // bound the work for very long chapters

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)
    ?.map((s) => s.trim())
    .filter(Boolean) ?? [];
}

function add(
  map: Map<string, Concept>,
  key: string,
  label: string,
  sentence: number,
  proper: boolean,
) {
  let c = map.get(key);
  if (!c) {
    c = { key, label, count: 0, sentences: new Set(), proper };
    map.set(key, c);
  }
  c.count += 1;
  c.sentences.add(sentence);
  if (proper) c.proper = true;
}

function extractConcepts(sentences: string[]): Map<string, Concept> {
  const map = new Map<string, Concept>();

  sentences.forEach((sentence, i) => {
    const words = sentence.split(/\s+/);
    let phrase: string[] = [];

    const flushPhrase = () => {
      if (phrase.length) {
        const label = phrase.join(" ");
        add(map, label.toLowerCase(), label, i, true);
      }
      phrase = [];
    };

    words.forEach((raw, idx) => {
      const clean = raw.replace(/[^A-Za-z'-]/g, "");
      const isCapital = /^[A-Z][A-Za-z'-]+$/.test(clean);
      const lower = clean.toLowerCase();

      // Proper-noun phrase: capitalized, not the first word, not a stopword.
      if (isCapital && idx !== 0 && !STOPWORDS.has(lower)) {
        phrase.push(clean);
        return;
      }
      flushPhrase();

      // Theme word: lowercase content word.
      if (/^[a-z]/.test(raw) && lower.length >= 4 && !STOPWORDS.has(lower)) {
        add(map, lower, lower, i, false);
      }
    });
    flushPhrase();
  });

  return map;
}

function scoreOf(c: Concept): number {
  // Entities are usually the focus, so weight them higher.
  return c.count * (c.proper ? 2 : 1);
}

export function analyzeChapter(rawText: string): ChapterAnalysis {
  const words = rawText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const text = words.slice(0, MAX_WORDS).join(" ");
  const sentences = splitSentences(text);

  const concepts = [...extractConcepts(sentences).values()].filter(
    (c) => c.count >= 2 || c.proper,
  );
  concepts.sort((a, b) => scoreOf(b) - scoreOf(a));

  const top = concepts.slice(0, 8);
  const nodes: GraphNode[] = top.map((c) => ({
    id: c.key,
    label: c.label.length > 22 ? c.label.slice(0, 21) + "…" : c.label,
    weight: scoreOf(c),
    kind: c.proper ? "entity" : "theme",
  }));

  const edges: GraphEdge[] = [];
  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      let shared = 0;
      for (const s of top[i].sentences) if (top[j].sentences.has(s)) shared++;
      if (shared > 0) {
        edges.push({ source: top[i].key, target: top[j].key, weight: shared });
      }
    }
  }
  edges.sort((a, b) => b.weight - a.weight);

  // Extractive summary: sentences richest in the top concepts.
  const scored = sentences.map((s, i) => {
    let score = 0;
    for (const c of top) if (c.sentences.has(i)) score += c.count;
    return { i, s, score };
  });
  const summary = scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);

  return {
    nodes,
    edges: edges.slice(0, 12),
    summary,
    themes: top.filter((c) => !c.proper).map((c) => c.label).slice(0, 6),
    entities: top.filter((c) => c.proper).map((c) => c.label).slice(0, 6),
    wordCount,
  };
}

/** Deterministic radial layout: node 0 (most central) in the middle. */
export function radialLayout(
  count: number,
  size: number,
): { x: number; y: number }[] {
  const cx = size / 2;
  const cy = size / 2;
  if (count <= 0) return [];
  const out = [{ x: cx, y: cy }];
  const rest = count - 1;
  const radius = size * 0.37;
  for (let i = 0; i < rest; i++) {
    const angle = (i / rest) * Math.PI * 2 - Math.PI / 2;
    out.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  }
  return out;
}
