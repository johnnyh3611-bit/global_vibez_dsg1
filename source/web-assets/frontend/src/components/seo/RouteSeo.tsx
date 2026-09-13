import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  SITE_ORIGIN,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  HOME_TITLE,
  HOME_DESCRIPTION,
  findSeoConfig,
  normalizeSeoPathname,
} from "./routeSeoConfig";

function ensureMeta(attribute: "name" | "property", value: string) {
  const selector = `meta[${attribute}="${value}"]`;
  let node = document.head.querySelector<HTMLMetaElement>(selector);
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute(attribute, value);
    document.head.appendChild(node);
  }
  return node;
}

function ensureCanonicalLink() {
  let node = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!node) {
    node = document.createElement("link");
    node.setAttribute("rel", "canonical");
    document.head.appendChild(node);
  }
  return node;
}

export default function RouteSeo() {
  const location = useLocation();

  useEffect(() => {
    const pathname = normalizeSeoPathname(location.pathname);
    const config = findSeoConfig(pathname);
    const canonicalPath = config?.canonicalPath ?? pathname;
    const canonicalUrl = `${SITE_ORIGIN}${canonicalPath === "/" ? "" : canonicalPath}` || SITE_ORIGIN;
    const title = config?.title ?? (pathname === "/" ? HOME_TITLE : DEFAULT_TITLE);
    const description = config?.description ?? (pathname === "/" ? HOME_DESCRIPTION : DEFAULT_DESCRIPTION);
    const robots = config?.robots ?? "index,follow";

    document.title = title;
    ensureCanonicalLink().setAttribute("href", canonicalUrl || `${SITE_ORIGIN}/`);
    ensureMeta("name", "description").setAttribute("content", description);
    ensureMeta("name", "robots").setAttribute("content", robots);
    ensureMeta("property", "og:title").setAttribute("content", title);
    ensureMeta("property", "og:description").setAttribute("content", description);
    ensureMeta("property", "og:url").setAttribute("content", canonicalUrl || `${SITE_ORIGIN}/`);
    ensureMeta("name", "twitter:title").setAttribute("content", title);
    ensureMeta("name", "twitter:description").setAttribute("content", description);
  }, [location.pathname]);

  return null;
}
