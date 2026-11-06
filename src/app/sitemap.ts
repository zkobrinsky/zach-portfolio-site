import type { MetadataRoute } from "next";
import { PAGES, SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return Object.keys(PAGES).map((path) => ({ url: `${SITE_URL}${path === "/" ? "" : path}` }));
}
