import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { handle, json, error } from "@/lib/api";
import { shareSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// GET /api/books/:id/share — current active share link, if any.
export async function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const userId = await requireUserId();
    const book = await prisma.book.findFirst({
      where: { id: params.id, ownerId: userId },
      select: { id: true },
    });
    if (!book) return error("Book not found.", 404);

    const link = await prisma.shareLink.findFirst({
      where: { bookId: params.id, ownerId: userId },
      orderBy: { createdAt: "desc" },
    });
    return json({ share: link ?? null });
  });
}

// POST /api/books/:id/share — create (or rotate) a read-only share link.
export async function POST(req: Request, { params }: Params) {
  return handle(async () => {
    const userId = await requireUserId();
    const book = await prisma.book.findFirst({
      where: { id: params.id, ownerId: userId },
      select: { id: true },
    });
    if (!book) return error("Book not found.", 404);

    const body = await req
      .json()
      .then((b) => shareSchema.parse(b))
      .catch(() => ({ expiresInDays: null }));

    const expiresAt =
      body.expiresInDays != null
        ? new Date(Date.now() + body.expiresInDays * 86400000)
        : null;

    // One active link per book: replace any prior links.
    await prisma.shareLink.deleteMany({
      where: { bookId: params.id, ownerId: userId },
    });

    const share = await prisma.shareLink.create({
      data: {
        bookId: params.id,
        ownerId: userId,
        token: crypto.randomBytes(24).toString("base64url"),
        expiresAt,
      },
    });
    return json({ share }, { status: 201 });
  });
}

// DELETE /api/books/:id/share — revoke sharing.
export async function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const userId = await requireUserId();
    await prisma.shareLink.deleteMany({
      where: { bookId: params.id, ownerId: userId },
    });
    return json({ ok: true });
  });
}
