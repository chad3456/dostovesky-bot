import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ReaderClient } from "@/components/reader/reader-client";

export const dynamic = "force-dynamic";

export default async function ReadPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.onboardedAt) redirect("/onboarding");

  const book = await prisma.book.findFirst({
    where: { id: params.id, ownerId: user.id },
    select: { id: true, title: true },
  });
  if (!book) notFound();

  return (
    <ReaderClient
      title={book.title}
      fileUrl={`/api/books/${book.id}/file`}
      bookId={book.id}
    />
  );
}
