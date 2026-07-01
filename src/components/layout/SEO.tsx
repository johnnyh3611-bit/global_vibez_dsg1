import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Global Vibez DSG | Official Platform",
  description:
    "Global Vibez DSG (Digital Social Gaming). The unified platform for dating, gaming, and streaming. Not affiliated with Global Vibes.",
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "https://globalvibezdsg.com",
  },
};
