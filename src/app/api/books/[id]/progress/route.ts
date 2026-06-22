import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { handle, json, error } from "@/lib/api";
import { progressSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

async function assertOwnedBook(userId: string, bookId: string) {
  const book = await prisma.book.findFirst({
    where: { id: bookId, ownerId: userId },
    select: { id: true },
  });
  return book;
}

// GET /api/books/:id/progress — latest synced reading position.
export async function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const userId = await requireUserId();
    if (!(await assertOwnedBook(userId, params.id))) {
      return error("Book not found.", 404);
    }
    const progress = await prisma.readingProgress.findUnique({
      where: { userId_bookId: { userId, bookId: params.id } },
      select: { cfi: true, percentage: true, label: true, updatedAt: true },
    });
    return json({ progress: progress ?? null });
  });
}

// PUT /api/books/:id/progress — upsert the reading position (cross-device sync).
export async function PUT(req: Request, { params }: Params) {
  return handle(async () => {
    const userId = await requireUserId();
    if (!(await assertOwnedBook(userId, params.id))) {
      return error("Book not found.", 404);
    }
    const body = progressSchema.parse(await req.json());

    const progress = await prisma.readingProgress.upsert({
      where: { userId_bookId: { userId, bookId: params.id } },
      update: {
        cfi: body.cfi ?? null,
        percentage: body.percentage,
        label: body.label ?? null,
      },
      create: {
        userId,
        bookId: params.id,
        cfi: body.cfi ?? null,
        percentage: body.percentage,
        label: body.label ?? null,
      },
      select: { cfi: true, percentage: true, label: true, updatedAt: true },
    });

    return json({ progress });
  });
}
