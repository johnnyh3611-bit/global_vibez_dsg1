import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { AppProviders } from "@/components/providers/AppProviders";
import { GlobalNavbar } from "@/components/nav/GlobalNavbar";
import { SITE_URL } from "@/lib/site-config";
import "./globals.css";

export const metadata: Metadata = {
  title: "SolDate — Wallet-Powered Dating",
  description: "Connect your Solana wallet to find your on-chain match",
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <AppProviders>
          <GlobalNavbar />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
