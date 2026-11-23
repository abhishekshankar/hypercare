import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";

import { Container } from "@/components/container";
import { CrisisStrip } from "@/components/crisis-strip";
import { Nav } from "@/components/nav";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-ui-sans",
  display: "swap",
});

const sourceSerif4 = Source_Serif_4({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-ui-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Alongside",
    template: "%s · Alongside",
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
    <html
      className={`${inter.variable} ${sourceSerif4.variable}`}
      lang="en"
    >
      <body className="min-h-screen antialiased">
        <div className="flex min-h-screen flex-col bg-background text-foreground shadow-sm">
          <CrisisStrip />
          <Nav />
          <main className="flex-1 pb-20 pt-8 md:pt-10">
            <Container>{children}</Container>
          </main>
        </div>
      </body>
    </html>
  );
}
