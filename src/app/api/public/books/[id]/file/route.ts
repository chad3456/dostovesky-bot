import { prisma } from "@/lib/prisma";
import { handle, error } from "@/lib/api";
import { readBookFile } from "@/lib/storage";
import { getPublicOwnerId } from "@/lib/public-library";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// GET /api/public/books/:id/file — stream a public book's EPUB bytes to anyone.
export async function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const ownerId = await getPublicOwnerId();
    const book = await prisma.book.findFirst({
      where: { id: params.id, ownerId },
      select: { filePath: true, fileName: true },
    });
    if (!book) return error("Book not found.", 404);

    const buffer = await readBookFile(book.filePath);
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/epub+zip",
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "public, max-age=3600",
        "Content-Disposition": `inline; filename="${encodeURIComponent(book.fileName)}"`,
      },
    });
  });
}
