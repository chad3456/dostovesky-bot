import { prisma } from "@/lib/prisma";

/** Remove all app + auth rows so each test starts from a clean slate. */
export async function resetDb() {
  // Order respects FK constraints; cascades cover most, but be explicit.
  await prisma.$transaction([
    prisma.presence.deleteMany(),
    prisma.highlight.deleteMany(),
    prisma.readingProgress.deleteMany(),
    prisma.shareLink.deleteMany(),
    prisma.preferences.deleteMany(),
    prisma.book.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.emailOtp.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export async function createUser(email = "reader@example.com", name = "Reader") {
  return prisma.user.create({ data: { email, name } });
}
