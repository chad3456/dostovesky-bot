import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { handle, json, error } from "@/lib/api";
import { parseEpubMetadata } from "@/lib/epub";
import { saveBookFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB

// GET /api/books — list the signed-in user's library.
export async function GET() {
  return handle(async () => {
    const userId = await requireUserId();
    const books = await prisma.book.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        author: true,
        cover: true,
        language: true,
        fileSize: true,
        createdAt: true,
        updatedAt: true,
        progress: {
          where: { userId },
          select: { percentage: true, updatedAt: true },
        },
      },
    });

    const shaped = books.map((b) => ({
      ...b,
      progress: b.progress[0]?.percentage ?? 0,
      lastReadAt: b.progress[0]?.updatedAt ?? null,
    }));

    return json({ books: shaped });
  });
}

// POST /api/books — upload a new EPUB (multipart/form-data, field "file").
export async function POST(req: NextRequest) {
  return handle(async () => {
    const userId = await requireUserId();

    const form = await req.formData().catch(() => null);
    if (!form) return error("Expected multipart/form-data upload.", 400);

    const file = form.get("file");
    if (!(file instanceof File)) {
      return error("Missing 'file' field.", 400);
    }

    const lowerName = file.name.toLowerCase();
    const looksEpub =
      lowerName.endsWith(".epub") ||
      file.type === "application/epub+zip" ||
      file.type === "application/zip";
    if (!looksEpub) {
      return error("Only .epub files are supported.", 415);
    }

    if (file.size === 0) return error("Uploaded file is empty.", 400);
    if (file.size > MAX_FILE_BYTES) {
      return error("File too large (max 50MB).", 413);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate + extract metadata before persisting anything.
    let meta;
    try {
      meta = await parseEpubMetadata(buffer);
    } catch (e) {
      return error(
        e instanceof Error ? e.message : "Could not read EPUB.",
        422,
      );
    }

    const relPath = await saveBookFile(buffer);

    const book = await prisma.book.create({
      data: {
        ownerId: userId,
        title: meta.title,
        author: meta.author,
        language: meta.language,
        description: meta.description,
        cover: meta.cover,
        filePath: relPath,
        fileSize: file.size,
        fileName: file.name,
      },
      select: {
        id: true,
        title: true,
        author: true,
        cover: true,
        language: true,
        fileSize: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return json({ book }, { status: 201 });
  });
}
