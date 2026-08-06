import { MetadataRoute } from "next";
import { getPublicWebsiteData } from "@/lib/public-queries";
import { SITE_URL } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;
  const { professionals } = await getPublicWebsiteData();

  const institutionalRoutes: MetadataRoute.Sitemap = [
    { path: "/clinica", changeFrequency: "monthly", priority: 0.7 },
    { path: "/especialidades", changeFrequency: "weekly", priority: 0.8 },
    { path: "/profissionais", changeFrequency: "weekly", priority: 0.8 },
    { path: "/convenios", changeFrequency: "monthly", priority: 0.7 },
    { path: "/estrutura", changeFrequency: "monthly", priority: 0.6 },
    { path: "/contato", changeFrequency: "monthly", priority: 0.7 },
  ].map(({ path, changeFrequency, priority }) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: changeFrequency as MetadataRoute.Sitemap[number]["changeFrequency"],
    priority,
  }));

  const professionalRoutes: MetadataRoute.Sitemap = professionals.map((prof) => ({
    url: `${baseUrl}/profissionais/${prof.id}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    ...institutionalRoutes,
    ...professionalRoutes,
    {
      url: `${baseUrl}/equipe`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/cliente`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
