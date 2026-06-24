import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const STORAGE_DIR = process.env.STORAGE_DIR || "./storage/books";

// When a Vercel Blob token is present we store uploads in Blob (durable on
// serverless hosts like Vercel). Otherwise we use the local filesystem, which
// is what local development and the test suite rely on.
function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN;
}
function blobEnabled(): boolean {
  return Boolean(blobToken());
}
function isBlobRef(ref: string): boolean {
  return /^https?:\/\//.test(ref);
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
  if (blobEnabled()) {
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

/** Read a stored EPUB file back into memory (Blob URL or disk path). */
export async function readBookFile(ref: string): Promise<Buffer> {
  if (isBlobRef(ref)) {
    const res = await fetch(ref);
    if (!res.ok) {
      throw new Error(`Failed to fetch stored file (${res.status})`);
    }
    return Buffer.from(await res.arrayBuffer());
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
  try {
    await fs.unlink(resolveBookPath(ref));
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") throw err;
  }
}
