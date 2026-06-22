import { handle, error } from "@/lib/api";
import { resolveShareToken } from "@/lib/share";
import { readBookFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Params = { params: { token: string } };

// GET /api/shared/:token/file — public, read-only EPUB stream for a share link.
export async function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const link = await resolveShareToken(params.token);
    if (!link) return error("This shared link is invalid or has expired.", 404);

    const buffer = await readBookFile(link.book.filePath);
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/epub+zip",
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `inline; filename="${encodeURIComponent(link.book.fileName)}"`,
      },
    });
  });
}
