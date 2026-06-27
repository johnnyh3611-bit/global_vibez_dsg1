import type { Metadata } from "next";
import { AppProviders } from "@/components/providers/AppProviders";
import { GlobalNavbar } from "@/components/nav/GlobalNavbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "SolDate — Wallet-Powered Dating",
  description: "Connect your Solana wallet to find your on-chain match",
  metadataBase: new URL("https://www.globalvibezdsg.com"),
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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <AppProviders>
          <GlobalNavbar />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
