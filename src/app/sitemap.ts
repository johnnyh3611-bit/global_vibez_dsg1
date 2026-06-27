import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";

const LAST_MODIFIED = new Date(process.env.VERCEL_GIT_COMMIT_DATE ?? "2026-01-01T00:00:00.000Z");

const routes = [
  { path: "", changeFrequency: "daily" as const, priority: 1 },
  { path: "/dating", changeFrequency: "daily" as const, priority: 0.9 },
  { path: "/tv", changeFrequency: "daily" as const, priority: 0.8 },
  { path: "/games", changeFrequency: "weekly" as const, priority: 0.7 },
  { path: "/design", changeFrequency: "monthly" as const, priority: 0.5 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: LAST_MODIFIED,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
