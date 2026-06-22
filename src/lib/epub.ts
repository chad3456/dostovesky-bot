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
