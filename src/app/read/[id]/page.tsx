import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReaderClient } from "@/components/reader/reader-client";

export const dynamic = "force-dynamic";

export default async function ReadPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const book = await prisma.book.findFirst({
    where: { id: params.id, ownerId: session.user.id },
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
