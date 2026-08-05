import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

export interface EpubMetadata {
  title: string;
  author: string | null;
  language: string | null;
  description: string | null;
  cover: string | null; // data URL or null
}

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  // Keep text content of nodes that also have attributes under "#text".
  textNodeName: "#text",
});

/** Embed covers only when reasonably small to keep the database lean. */
const MAX_COVER_BYTES = 600 * 1024;

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(node: unknown): string | null {
  if (node == null) return null;
  if (typeof node === "string") return node.trim() || null;
  if (typeof node === "number") return String(node);
  if (typeof node === "object") {
    const t = (node as Record<string, unknown>)["#text"];
    if (typeof t === "string") return t.trim() || null;
    if (typeof t === "number") return String(t);
  }
  return null;
}

function dirname(p: string): string {
  const idx = p.lastIndexOf("/");
  return idx === -1 ? "" : p.slice(0, idx);
}

function joinPath(base: string, rel: string): string {
  if (!base) return rel.replace(/^\//, "");
  const parts = `${base}/${rel}`.split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

function mimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

/**
 * Parse an EPUB file buffer and extract its metadata. Throws a descriptive
 * error if the buffer is not a structurally valid EPUB.
 */
export async function parseEpubMetadata(buffer: Buffer): Promise<EpubMetadata> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error("File is not a valid ZIP/EPUB archive.");
  }

  const containerFile = zip.file("META-INF/container.xml");
  if (!containerFile) {
    throw new Error("Invalid EPUB: missing META-INF/container.xml.");
  }

  const containerXml = await containerFile.async("string");
  const container = xml.parse(containerXml);
  const rootfiles = asArray(container?.container?.rootfiles?.rootfile);
  const opfPath: string | undefined = rootfiles[0]?.["@_full-path"];
  if (!opfPath) {
    throw new Error("Invalid EPUB: no OPF rootfile declared.");
  }

  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    throw new Error("Invalid EPUB: OPF file not found.");
  }

  const opfXml = await opfFile.async("string");
  const opf = xml.parse(opfXml);
  const pkg = opf?.package;
  if (!pkg) {
    throw new Error("Invalid EPUB: malformed OPF package.");
  }

  const metadata = pkg.metadata ?? {};
  const opfDir = dirname(opfPath);

  // Title
  const title =
    textOf(asArray(metadata.title)[0]) || "Untitled";

  // Author (dc:creator may be multiple)
  const creators = asArray(metadata.creator).map(textOf).filter(Boolean);
  const author = creators.length ? (creators.join(", ") as string) : null;

  // Language
  const language = textOf(asArray(metadata.language)[0]);

  // Description
  const description = textOf(asArray(metadata.description)[0]);

  // Cover resolution
  const cover = await resolveCover(zip, pkg, metadata, opfDir);

  return { title, author, language, description, cover };
}

async function resolveCover(
  zip: JSZip,
  pkg: Record<string, any>,
  metadata: Record<string, any>,
  opfDir: string,
): Promise<string | null> {
  const items = asArray(pkg?.manifest?.item);
  if (!items.length) return null;

  // Strategy 1: manifest item with properties="cover-image" (EPUB 3).
  let coverItem = items.find((it: any) =>
    (it?.["@_properties"] ?? "").split(/\s+/).includes("cover-image"),
  );

  // Strategy 2: <meta name="cover" content="itemId"> (EPUB 2).
  if (!coverItem) {
    const metas = asArray(metadata.meta);
    const coverMeta = metas.find((m: any) => m?.["@_name"] === "cover");
    const coverId = coverMeta?.["@_content"];
    if (coverId) {
      coverItem = items.find((it: any) => it?.["@_id"] === coverId);
    }
  }

  // Strategy 3: any image item whose id/href mentions "cover".
  if (!coverItem) {
    coverItem = items.find(
      (it: any) =>
        (it?.["@_media-type"] ?? "").startsWith("image/") &&
        /cover/i.test(`${it?.["@_id"] ?? ""} ${it?.["@_href"] ?? ""}`),
    );
  }

  const href: string | undefined = coverItem?.["@_href"];
  if (!href) return null;

  const coverPath = joinPath(opfDir, decodeURIComponent(href));
  const file = zip.file(coverPath);
  if (!file) return null;

  const data = await file.async("nodebuffer");
  if (data.byteLength > MAX_COVER_BYTES) return null;

  const mime =
    (coverItem?.["@_media-type"] as string) || mimeFromName(coverPath);
  return `data:${mime};base64,${data.toString("base64")}`;
}

export interface EpubChapter {
  /** 0-based position in the reading order. */
  index: number;
  title: string;
  /** Plain text with markup, scripts and styles stripped. */
  text: string;
  wordCount: number;
}

/** Strip XHTML to readable plain text. */
function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|h[1-6]|li|br|section|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&(?:quot|#34);/gi, '"')
    .replace(/&(?:apos|#39);/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();
}

/** First heading in the document, if any — used as the chapter title. */
function headingOf(html: string): string | null {
  const m = html.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  if (!m) return null;
  const t = htmlToText(m[1]).replace(/\s+/g, " ").trim();
  return t ? t.slice(0, 120) : null;
}

/** Chapters shorter than this are treated as front/back matter and dropped. */
const MIN_CHAPTER_WORDS = 220;

/**
 * Extract the readable chapters of an EPUB in spine (reading) order.
 * Front matter, covers and other very short sections are filtered out so
 * episodes map to substantive chapters.
 */
export async function extractEpubChapters(
  buffer: Buffer,
): Promise<EpubChapter[]> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error("File is not a valid ZIP/EPUB archive.");
  }

  const containerFile = zip.file("META-INF/container.xml");
  if (!containerFile) throw new Error("Invalid EPUB: missing container.xml.");
  const container = xml.parse(await containerFile.async("string"));
  const opfPath: string | undefined = asArray(
    container?.container?.rootfiles?.rootfile,
  )[0]?.["@_full-path"];
  if (!opfPath) throw new Error("Invalid EPUB: no OPF rootfile declared.");

  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error("Invalid EPUB: OPF file not found.");
  const pkg = xml.parse(await opfFile.async("string"))?.package;
  if (!pkg) throw new Error("Invalid EPUB: malformed OPF package.");

  const opfDir = dirname(opfPath);
  const manifest = new Map<string, string>();
  for (const item of asArray(pkg?.manifest?.item)) {
    const id = item?.["@_id"];
    const href = item?.["@_href"];
    const type = item?.["@_media-type"] ?? "";
    if (id && href && /xhtml|html|xml/.test(type)) {
      manifest.set(String(id), String(href));
    }
  }

  const chapters: EpubChapter[] = [];
  for (const ref of asArray(pkg?.spine?.itemref)) {
    const idref = ref?.["@_idref"];
    if (!idref) continue;
    const href = manifest.get(String(idref));
    if (!href) continue;

    const file = zip.file(joinPath(opfDir, decodeURIComponent(href.split("#")[0])));
    if (!file) continue;

    const html = await file.async("string");
    const text = htmlToText(html);
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount < MIN_CHAPTER_WORDS) continue;

    chapters.push({
      index: chapters.length,
      title: headingOf(html) || `Chapter ${chapters.length + 1}`,
      text,
      wordCount,
    });
  }

  if (!chapters.length) {
    throw new Error("No readable chapters found in this EPUB.");
  }
  return chapters;
}
