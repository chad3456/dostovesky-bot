import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { LibraryClient } from "@/components/library-client";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        name={session.user.name ?? null}
        email={session.user.email ?? null}
        image={session.user.image ?? null}
      />
      <LibraryClient />
    </div>
  );
}
