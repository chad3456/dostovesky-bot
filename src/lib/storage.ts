import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const STORAGE_DIR = process.env.STORAGE_DIR || "./storage/books";

/** Absolute path to the configured storage directory. */
export function storageRoot(): string {
  return path.resolve(process.cwd(), STORAGE_DIR);
}

async function ensureStorageDir(): Promise<string> {
  const root = storageRoot();
  await fs.mkdir(root, { recursive: true });
  return root;
}

/**
 * Persist an uploaded EPUB buffer to disk under a randomly generated,
 * collision-resistant filename. Returns the path relative to the storage root
 * (this is what we store in the database).
 */
export async function saveBookFile(buffer: Buffer): Promise<string> {
  const root = await ensureStorageDir();
  const id = crypto.randomBytes(16).toString("hex");
  const relPath = `${id}.epub`;
  await fs.writeFile(path.join(root, relPath), buffer);
  return relPath;
}

/** Resolve a stored relative path to an absolute path, guarding traversal. */
export function resolveBookPath(relPath: string): string {
  const root = storageRoot();
  const abs = path.resolve(root, relPath);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new Error("Invalid storage path");
  }
  return abs;
}

/** Read a stored EPUB file back into memory. */
export async function readBookFile(relPath: string): Promise<Buffer> {
  return fs.readFile(resolveBookPath(relPath));
}

/** Remove a stored EPUB file. Missing files are ignored. */
export async function deleteBookFile(relPath: string): Promise<void> {
  try {
    await fs.unlink(resolveBookPath(relPath));
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") throw err;
  }
}
