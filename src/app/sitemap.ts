import { MetadataRoute } from "next";
import { getPublicWebsiteData } from "@/lib/public-queries";
import { SITE_URL } from "@/lib/site-url";
import { buildEntitySlug } from "@/lib/slug";

// Só entram no sitemap as rotas públicas e indexáveis. Área do cliente,
// login/signup e o painel administrativo não têm valor de busca (conteúdo
// privado/duplicado por usuário) e já são bloqueados em robots.ts + noindex
// — mantê-los fora daqui evita sinalizar ao Google páginas que ele nunca
// deve indexar.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;
  const { professionals, specialties } = await getPublicWebsiteData();

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
    url: `${baseUrl}/profissionais/${buildEntitySlug(prof.fullName, prof.id)}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const specialtyRoutes: MetadataRoute.Sitemap = specialties.map((spec) => ({
    url: `${baseUrl}/especialidades/${buildEntitySlug(spec.name, spec.id)}`,
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
    ...specialtyRoutes,
  ];
}
