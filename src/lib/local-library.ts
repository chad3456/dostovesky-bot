// Fully client-side book library backed by IndexedDB. No server, account, or
// database required — EPUB files live in the browser so they can be reopened
// across sessions on this device.

export interface LocalBook {
  id: string;
  title: string;
  author: string | null;
  cover: string | null; // data URL or null
  fileName: string;
  size: number;
  addedAt: number;
}

const DB_NAME = "lumen-local";
const DB_VERSION = 1;
const META_STORE = "meta";
const DATA_STORE = "data";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(DATA_STORE)) {
        db.createObjectStore(DATA_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function blobUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

interface ExtractedMeta {
  title: string;
  author: string | null;
  cover: string | null;
}

/** Read title/author/cover from EPUB bytes using epub.js (no server). */
async function extractMeta(
  buffer: ArrayBuffer,
  fallbackTitle: string,
): Promise<ExtractedMeta> {
  try {
    const ePub = (await import("epubjs")).default;
    const book = ePub(buffer.slice(0));
    await book.ready;
    const md: any = (book as any).packaging?.metadata ?? {};
    let cover: string | null = null;
    try {
      const url = await (book as any).coverUrl();
      if (url) cover = await blobUrlToDataUrl(url);
    } catch {
      /* no cover */
    }
    try {
      (book as any).destroy();
    } catch {}
    return {
      title: (md.title || "").trim() || fallbackTitle,
      author: (md.creator || "").trim() || null,
      cover,
    };
  } catch {
    return { title: fallbackTitle, author: null, cover: null };
  }
}

/** Add an uploaded EPUB to the local library. */
export async function addBook(file: File): Promise<LocalBook> {
  const buffer = await file.arrayBuffer();
  const fallbackTitle = file.name.replace(/\.epub$/i, "");
  const meta = await extractMeta(buffer, fallbackTitle);

  const book: LocalBook = {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: meta.title,
    author: meta.author,
    cover: meta.cover,
    fileName: file.name,
    size: file.size,
    addedAt: Date.now(),
  };

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([META_STORE, DATA_STORE], "readwrite");
    tx.objectStore(META_STORE).put(book);
    tx.objectStore(DATA_STORE).put({ id: book.id, data: buffer });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
  return book;
}

/** List library entries, newest first (metadata only — no file bytes). */
export async function listBooks(): Promise<LocalBook[]> {
  const db = await openDb();
  const all = await promisify(
    db.transaction(META_STORE).objectStore(META_STORE).getAll(),
  );
  db.close();
  return (all as LocalBook[]).sort((a, b) => b.addedAt - a.addedAt);
}

/** Fetch the raw EPUB bytes for a book. */
export async function getBookData(id: string): Promise<ArrayBuffer | null> {
  const db = await openDb();
  const rec = await promisify(
    db.transaction(DATA_STORE).objectStore(DATA_STORE).get(id),
  );
  db.close();
  return (rec as { data: ArrayBuffer } | undefined)?.data ?? null;
}

/** Remove a book and its stored reading data. */
export async function deleteBook(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([META_STORE, DATA_STORE], "readwrite");
    tx.objectStore(META_STORE).delete(id);
    tx.objectStore(DATA_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();

  // Also clear this book's local reading state.
  try {
    localStorage.removeItem(`lumen:progress:${id}`);
    localStorage.removeItem(`lumen:highlights:${id}`);
  } catch {}
}
