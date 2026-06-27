import { handle, json } from "@/lib/api";
import { createSyncLibrary } from "@/lib/sync";

export const dynamic = "force-dynamic";

// POST /api/sync/new — create a fresh anonymous library and return its Sync
// Code. The client then signs in with the code via the "sync-code" provider.
export async function POST() {
  return handle(async () => {
    const { code } = await createSyncLibrary();
    return json({ code }, { status: 201 });
  });
}
