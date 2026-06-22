import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { handle, json } from "@/lib/api";
import { preferencesSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const DEFAULTS = {
  theme: "light",
  fontFamily: "serif",
  fontSize: 18,
  lineHeight: 1.6,
  margin: 24,
  justify: true,
  flow: "paginated",
};

// GET /api/preferences — the user's reading preferences (synced across devices).
export async function GET() {
  return handle(async () => {
    const userId = await requireUserId();
    const prefs = await prisma.preferences.findUnique({ where: { userId } });
    return json({ preferences: prefs ?? { ...DEFAULTS, userId } });
  });
}

// PUT /api/preferences — upsert reading preferences.
export async function PUT(req: Request) {
  return handle(async () => {
    const userId = await requireUserId();
    const body = preferencesSchema.parse(await req.json());

    const preferences = await prisma.preferences.upsert({
      where: { userId },
      update: body,
      create: { userId, ...DEFAULTS, ...body },
    });
    return json({ preferences });
  });
}
