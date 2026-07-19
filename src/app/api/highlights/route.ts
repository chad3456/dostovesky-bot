import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { handle, json } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET /api/highlights — every highlight/note of the signed-in user across all
// their books, with book metadata for the Notes browser. Sorting/pagination
// happen client-side (per-user note counts stay small).
export async function GET() {
  return handle(async () => {
    const userId = await requireUserId();
    const rows = await prisma.highlight.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { book: { select: { title: true, author: true } } },
    });
    const highlights = rows.map(({ book, ...h }) => ({
      ...h,
      bookTitle: book.title,
      bookAuthor: book.author,
    }));
    return json({ highlights });
  });
}
