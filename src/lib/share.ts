import { prisma } from "@/lib/prisma";

/**
 * Resolve a share token to its book if the link exists and has not expired.
 * Returns null otherwise.
 */
export async function resolveShareToken(token: string) {
  const link = await prisma.shareLink.findUnique({
    where: { token },
    include: {
      book: {
        select: {
          id: true,
          title: true,
          author: true,
          language: true,
          description: true,
          cover: true,
          fileName: true,
          filePath: true,
        },
      },
    },
  });
  if (!link) return null;
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) return null;
  return link;
}
