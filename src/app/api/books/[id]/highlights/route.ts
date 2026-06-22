import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { handle, json, error } from "@/lib/api";
import { createHighlightSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

async function assertOwnedBook(userId: string, bookId: string) {
  return prisma.book.findFirst({
    where: { id: bookId, ownerId: userId },
    select: { id: true },
  });
}

// GET /api/books/:id/highlights — all highlights for this book (synced).
export async function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const userId = await requireUserId();
    if (!(await assertOwnedBook(userId, params.id))) {
      return error("Book not found.", 404);
    }
    const highlights = await prisma.highlight.findMany({
      where: { userId, bookId: params.id },
      orderBy: { createdAt: "asc" },
    });
    return json({ highlights });
  });
}

// POST /api/books/:id/highlights — create a highlight.
export async function POST(req: Request, { params }: Params) {
  return handle(async () => {
    const userId = await requireUserId();
    if (!(await assertOwnedBook(userId, params.id))) {
      return error("Book not found.", 404);
    }
    const body = createHighlightSchema.parse(await req.json());

    const highlight = await prisma.highlight.create({
      data: {
        userId,
        bookId: params.id,
        cfiRange: body.cfiRange,
        text: body.text,
        color: body.color,
        note: body.note ?? null,
        chapter: body.chapter ?? null,
      },
    });

    return json({ highlight }, { status: 201 });
  });
}
