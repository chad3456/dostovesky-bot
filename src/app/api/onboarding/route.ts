import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { handle, json } from "@/lib/api";
import { onboardingSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const PREF_DEFAULTS = {
  theme: "light",
  fontFamily: "serif",
  fontSize: 18,
  lineHeight: 1.6,
  margin: 24,
  justify: true,
  flow: "paginated",
};

// GET /api/onboarding — whether the current user has completed onboarding.
export async function GET() {
  return handle(async () => {
    const userId = await requireUserId();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, onboardedAt: true },
    });
    return json({
      onboarded: Boolean(user?.onboardedAt),
      name: user?.name ?? null,
      email: user?.email ?? null,
    });
  });
}

// PUT /api/onboarding — complete onboarding: save name + initial preferences.
export async function PUT(req: Request) {
  return handle(async () => {
    const userId = await requireUserId();
    const body = onboardingSchema.parse(await req.json());

    const prefPatch = {
      ...(body.theme ? { theme: body.theme } : {}),
      ...(body.fontFamily ? { fontFamily: body.fontFamily } : {}),
      ...(body.fontSize ? { fontSize: body.fontSize } : {}),
    };

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { name: body.name, onboardedAt: new Date() },
      }),
      prisma.preferences.upsert({
        where: { userId },
        update: prefPatch,
        create: { userId, ...PREF_DEFAULTS, ...prefPatch },
      }),
    ]);

    return json({ ok: true });
  });
}
