import { handle, json, error } from "@/lib/api";
import { resolveShareToken } from "@/lib/share";

export const dynamic = "force-dynamic";

type Params = { params: { token: string } };

// GET /api/shared/:token — public, read-only book metadata for a share link.
export async function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const link = await resolveShareToken(params.token);
    if (!link) return error("This shared link is invalid or has expired.", 404);
    const { filePath, ...book } = link.book;
    void filePath;
    return json({ book });
  });
}
