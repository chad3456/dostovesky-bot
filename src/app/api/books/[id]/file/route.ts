import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { handle, error } from "@/lib/api";
import { readBookFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// GET /api/books/:id/file — stream the raw EPUB bytes to the reader (owner only).
export async function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const userId = await requireUserId();
    const book = await prisma.book.findFirst({
      where: { id: params.id, ownerId: userId },
      select: { filePath: true, fileName: true },
    });
    if (!book) return error("Book not found.", 404);

    const buffer = await readBookFile(book.filePath);
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/epub+zip",
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `inline; filename="${encodeURIComponent(book.fileName)}"`,
      },
    });
  });
}
