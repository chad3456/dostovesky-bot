import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { hasDatabase } from "@/lib/db-url";

const STORAGE_DIR = process.env.STORAGE_DIR || "./storage/books";

// File backend selection. A stored "ref" encodes which backend holds it:
//   • Blob       → an https URL
//   • Postgres   → "db:<id>"
//   • Local disk → a relative path
// Priority for NEW uploads: explicit FILE_STORAGE override → Vercel Blob (if a
// token is set) → Postgres (on serverless hosts, e.g. Vercel + Supabase) →
// local disk (dev/tests).
function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN;
}
function blobEnabled(): boolean {
  return Boolean(blobToken());
}
function isBlobRef(ref: string): boolean {
  return /^https?:\/\//.test(ref);
}
function isDbRef(ref: string): boolean {
  return ref.startsWith("db:");
}

function fileStore(): "blob" | "db" | "disk" {
  const explicit = process.env.FILE_STORAGE;
  if (explicit === "blob" || explicit === "db" || explicit === "disk") {
    return explicit;
  }
  if (blobEnabled()) return "blob";
  // On serverless hosts the filesystem is ephemeral, so persist to Postgres
  // when a database is configured.
  if (process.env.VERCEL && hasDatabase()) return "db";
  return "disk";
}

/** Absolute path to the configured (disk) storage directory. */
export function storageRoot(): string {
  return path.resolve(process.cwd(), STORAGE_DIR);
}

async function ensureStorageDir(): Promise<string> {
  const root = storageRoot();
  await fs.mkdir(root, { recursive: true });
  return root;
}

/**
 * Persist an uploaded EPUB buffer. Returns a reference to store in the
 * database — a Blob URL (Vercel) or a path relative to the storage root (disk).
 */
export async function saveBookFile(buffer: Buffer): Promise<string> {
  const store = fileStore();

  if (store === "blob") {
    const { put } = await import("@vercel/blob");
    const id = crypto.randomBytes(16).toString("hex");
    const result = await put(`books/${id}.epub`, buffer, {
      access: "public",
      contentType: "application/epub+zip",
      addRandomSuffix: true,
      token: blobToken(),
    });
    return result.url;
  }

  if (store === "db") {
    const row = await prisma.bookBlob.create({
      data: { data: buffer },
      select: { id: true },
    });
    return `db:${row.id}`;
  }

  const root = await ensureStorageDir();
  const id = crypto.randomBytes(16).toString("hex");
  const relPath = `${id}.epub`;
  await fs.writeFile(path.join(root, relPath), buffer);
  return relPath;
}

/** Resolve a stored relative (disk) path to an absolute path, guarding traversal. */
export function resolveBookPath(relPath: string): string {
  const root = storageRoot();
  const abs = path.resolve(root, relPath);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new Error("Invalid storage path");
  }
  return abs;
}

/** Read a stored EPUB file back into memory (Blob URL, Postgres, or disk). */
export async function readBookFile(ref: string): Promise<Buffer> {
  if (isBlobRef(ref)) {
    const res = await fetch(ref);
    if (!res.ok) {
      throw new Error(`Failed to fetch stored file (${res.status})`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
  if (isDbRef(ref)) {
    const row = await prisma.bookBlob.findUnique({
      where: { id: ref.slice(3) },
      select: { data: true },
    });
    if (!row) throw new Error("Stored file not found");
    return Buffer.from(row.data);
  }
  return fs.readFile(resolveBookPath(ref));
}

/** Remove a stored EPUB file. Missing files are ignored. */
export async function deleteBookFile(ref: string): Promise<void> {
  if (isBlobRef(ref)) {
    const { del } = await import("@vercel/blob");
    await del(ref, { token: blobToken() }).catch(() => {});
    return;
  }
  if (isDbRef(ref)) {
    await prisma.bookBlob.delete({ where: { id: ref.slice(3) } }).catch(() => {});
    return;
  }
  try {
    await fs.unlink(resolveBookPath(ref));
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") throw err;
  }
}
