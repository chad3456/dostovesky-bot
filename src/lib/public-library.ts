import { prisma } from "@/lib/prisma";

// All books in the shared public library belong to a single sentinel "owner"
// row. This keeps the public collection cleanly separated from real users'
// private libraries while reusing the existing Book model.
const PUBLIC_OWNER_EMAIL = "public-library@lumen.local";

/** Get (creating if needed) the id of the shared public-library owner. */
export async function getPublicOwnerId(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: PUBLIC_OWNER_EMAIL },
    update: {},
    create: {
      email: PUBLIC_OWNER_EMAIL,
      name: "Public Library",
      onboardedAt: new Date(),
    },
    select: { id: true },
  });
  return user.id;
}
