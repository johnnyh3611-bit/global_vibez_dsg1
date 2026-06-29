import type { Metadata } from "next";
import { AppProviders } from "@/components/providers/AppProviders";
import { ClientNavbar } from "@/components/nav/ClientNavbar";
import { metadata as seoMetadata } from "@/components/layout/SEO";
import "./globals.css";

export const metadata: Metadata = seoMetadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <AppProviders>
          <ClientNavbar />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
