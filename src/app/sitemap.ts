import type { MetadataRoute } from "next";

import { SITE_URL } from "@/content/site";
import { EXAMPLES } from "@/content/examples";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    "/",
    "/how-it-works",
    "/features",
    "/packages",
    "/examples",
    "/examples/silver",
    "/examples/gold",
    "/examples/platinum",
    "/faq",
    "/about",
    "/contact",
    "/for-wedding-companies",
    "/privacy",
    "/terms",
    "/cookies",
  ].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));

  const themeRoutes: MetadataRoute.Sitemap = EXAMPLES.map((example) => ({
    url: `${SITE_URL}/examples/${example.id}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...themeRoutes];
}