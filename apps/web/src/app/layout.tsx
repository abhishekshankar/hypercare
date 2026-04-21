import type { Metadata } from "next";

import { Container } from "@/components/container";
import { CrisisStrip } from "@/components/crisis-strip";
import { Nav } from "@/components/nav";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Hypercare",
    template: "%s · Hypercare",
  },
  description:
    "The AI guide that helps you care for someone with dementia — tailored to their stage, your situation, and what's actually happening this week.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <CrisisStrip />
        <Nav />
        <main className="pb-16 pt-8">
          <Container>{children}</Container>
        </main>
      </body>
    </html>
  );
}
