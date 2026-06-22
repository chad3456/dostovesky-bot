import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { handle, json, error } from "@/lib/api";
import { deleteBookFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// GET /api/books/:id — book metadata (owner only).
export async function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const userId = await requireUserId();
    const book = await prisma.book.findFirst({
      where: { id: params.id, ownerId: userId },
      select: {
        id: true,
        title: true,
        author: true,
        language: true,
        description: true,
        cover: true,
        fileSize: true,
        fileName: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!book) return error("Book not found.", 404);
    return json({ book });
  });
}

// DELETE /api/books/:id — remove book, its file, highlights and progress.
export async function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const userId = await requireUserId();
    const book = await prisma.book.findFirst({
      where: { id: params.id, ownerId: userId },
      select: { id: true, filePath: true },
    });
    if (!book) return error("Book not found.", 404);

    // Cascades remove highlights/progress/shareLinks via schema relations.
    await prisma.book.delete({ where: { id: book.id } });
    await deleteBookFile(book.filePath);

    return json({ ok: true });
  });
}
