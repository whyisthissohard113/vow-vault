import type { MetadataRoute } from "next";

import { SITE_URL } from "@/content/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private vaults are noindex internally; keep organic crawling to marketing only.
        disallow: ["/login", "/register", "/w/", "/api/", "/dashboard", "/admin"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}