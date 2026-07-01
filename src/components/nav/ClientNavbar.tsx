"use client";

import dynamic from "next/dynamic";

export const ClientNavbar = dynamic(
  () => import("@/components/nav/GlobalNavbar").then((mod) => mod.GlobalNavbar),
  { ssr: false },
);
