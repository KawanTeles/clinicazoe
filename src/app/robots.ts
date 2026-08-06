import { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = SITE_URL;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/appointments/", "/audit/", "/financial/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
