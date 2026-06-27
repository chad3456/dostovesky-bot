import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AppHeader } from "@/components/app-header";
import { LibraryClient } from "@/components/library-client";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.onboardedAt) redirect("/onboarding");

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        name={user.name}
        email={user.email}
        image={user.image}
        syncCode={user.syncCode}
      />
      <LibraryClient />
    </div>
  );
}
