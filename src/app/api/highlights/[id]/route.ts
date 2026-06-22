import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { handle, json, error } from "@/lib/api";
import { updateHighlightSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// PATCH /api/highlights/:id — update color or note.
export async function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const userId = await requireUserId();
    const existing = await prisma.highlight.findFirst({
      where: { id: params.id, userId },
      select: { id: true },
    });
    if (!existing) return error("Highlight not found.", 404);

    const body = updateHighlightSchema.parse(await req.json());
    const highlight = await prisma.highlight.update({
      where: { id: params.id },
      data: {
        ...(body.color !== undefined ? { color: body.color } : {}),
        ...(body.note !== undefined ? { note: body.note } : {}),
      },
    });
    return json({ highlight });
  });
}

// DELETE /api/highlights/:id — remove a highlight.
export async function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const userId = await requireUserId();
    const existing = await prisma.highlight.findFirst({
      where: { id: params.id, userId },
      select: { id: true },
    });
    if (!existing) return error("Highlight not found.", 404);

    await prisma.highlight.delete({ where: { id: params.id } });
    return json({ ok: true });
  });
}
