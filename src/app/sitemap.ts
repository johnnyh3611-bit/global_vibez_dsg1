import type { MetadataRoute } from "next";

const BASE_URL = "https://www.globalvibezdsg.com";

const routes = [
  { path: "", changeFrequency: "daily" as const, priority: 1 },
  { path: "/dating", changeFrequency: "daily" as const, priority: 0.9 },
  { path: "/tv", changeFrequency: "daily" as const, priority: 0.8 },
  { path: "/games", changeFrequency: "weekly" as const, priority: 0.7 },
  { path: "/design", changeFrequency: "monthly" as const, priority: 0.5 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${BASE_URL}${route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
