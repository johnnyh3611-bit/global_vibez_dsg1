"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { label: "Home", href: "/" },
  { label: "Dating", href: "/dating" },
  { label: "Games", href: "/games" },
  { label: "TV Network", href: "/tv" },
  { label: "Dealer Lounge", href: "/dealer" },
] as const;

// Routes that own the full viewport / their own chrome — no global nav.
const HIDDEN_ON = ["/", "/login", "/dealer"];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function GlobalNavbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (HIDDEN_ON.includes(pathname)) return null;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-surface-glass-border bg-surface-glass shadow-glass backdrop-blur-md">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex min-h-11 items-center text-lg font-bold tracking-tight text-white"
        >
          Global <span className="ml-1 text-brand-accent">Vibez</span>
        </Link>

        {/* Desktop links */}
        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition-colors ${
                    active
                      ? "bg-surface-glass-strong text-white"
                      : "text-white/60 hover:bg-surface-glass hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Toggle navigation menu"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white/80 hover:bg-surface-glass hover:text-white md:hidden"
        >
          <span className="text-xl leading-none">{open ? "\u2715" : "\u2630"}</span>
        </button>
      </nav>

      {/* Mobile dropdown */}
      {open && (
        <ul className="flex flex-col gap-1 border-t border-surface-glass-border px-4 pb-4 pt-2 md:hidden">
          {LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center rounded-glass px-4 text-base font-medium transition-colors ${
                    active
                      ? "bg-surface-glass-strong text-white"
                      : "text-white/70 hover:bg-surface-glass hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </header>
  );
}
