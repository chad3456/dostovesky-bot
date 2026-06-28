import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, json, error } from "@/lib/api";
import { parseEpubMetadata } from "@/lib/epub";
import { saveBookFile } from "@/lib/storage";
import { getPublicOwnerId } from "@/lib/public-library";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB

// GET /api/public/books — list every book in the shared public library.
// No authentication: anyone with the URL can see all uploads.
export async function GET() {
  return handle(async () => {
    const ownerId = await getPublicOwnerId();
    const books = await prisma.book.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        author: true,
        cover: true,
        language: true,
        fileSize: true,
        createdAt: true,
      },
    });
    return json({ books });
  });
}

// POST /api/public/books — anyone can add an EPUB to the shared library.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const ownerId = await getPublicOwnerId();

    const form = await req.formData().catch(() => null);
    if (!form) return error("Expected multipart/form-data upload.", 400);

    const file = form.get("file");
    if (!(file instanceof File)) return error("Missing 'file' field.", 400);

    const lowerName = file.name.toLowerCase();
    const looksEpub =
      lowerName.endsWith(".epub") ||
      file.type === "application/epub+zip" ||
      file.type === "application/zip";
    if (!looksEpub) return error("Only .epub files are supported.", 415);
    if (file.size === 0) return error("Uploaded file is empty.", 400);
    if (file.size > MAX_FILE_BYTES) return error("File too large (max 50MB).", 413);

    const buffer = Buffer.from(await file.arrayBuffer());

    let meta;
    try {
      meta = await parseEpubMetadata(buffer);
    } catch (e) {
      return error(e instanceof Error ? e.message : "Could not read EPUB.", 422);
    }

    const relPath = await saveBookFile(buffer);

    const book = await prisma.book.create({
      data: {
        ownerId,
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
      },
    });

    return json({ book }, { status: 201 });
  });
}
