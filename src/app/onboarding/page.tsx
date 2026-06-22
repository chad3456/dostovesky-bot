import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { OnboardingClient } from "@/components/onboarding-client";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.onboardedAt) redirect("/library");

  const defaultName =
    user.name && !user.name.includes("@") ? user.name : "";

  return <OnboardingClient defaultName={defaultName} email={user.email} />;
}
