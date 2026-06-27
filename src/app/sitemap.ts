import type { MetadataRoute } from "next";

const BASE_URL = "https://www.globalvibezdsg.com";

const routes = ["", "/dating", "/games", "/tv", "/design"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.7,
  }));
}
