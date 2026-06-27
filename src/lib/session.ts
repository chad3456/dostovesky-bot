import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

/** Return the current user id, or throw UnauthorizedError if not signed in. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new UnauthorizedError();
  return id;
}

/** Return the current user id or null. */
export async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export interface CurrentUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  onboardedAt: Date | null;
  syncCode: string | null;
}

/** Load the full current-user record (incl. onboarding status), or null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      onboardedAt: true,
      syncCode: true,
    },
  });
}
