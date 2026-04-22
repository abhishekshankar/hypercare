import { requireSession } from "@/lib/auth/session";

export default async function AuthedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireSession();
  return children;
}
