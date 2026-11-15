import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/guides/"],
        disallow: ["/api/", "/dashboard", "/remote", "/signin"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
