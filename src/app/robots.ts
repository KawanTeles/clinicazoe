import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://clinicazoe.com.br";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/appointments/", "/audit/", "/financial/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
