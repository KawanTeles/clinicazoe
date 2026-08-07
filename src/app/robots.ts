import { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

// Rotas do painel administrativo (grupo de rotas `(admin)`, sem prefixo na
// URL), da área do paciente/equipe e de autenticação — nenhuma delas deve
// ser rastreada ou indexada. Mantido em sincronia com o robots noindex de
// cada rota (defesa em profundidade: disallow evita rastreio, noindex evita
// indexação mesmo se a URL for descoberta por outro caminho).
// Sem barra final: o App Router não usa trailing slash nas URLs (ex.:
// "/dashboard", não "/dashboard/"). Um disallow com barra final não bloqueia
// a rota exata — só as filhas — por isso todos os prefixos abaixo cobrem a
// rota raiz e tudo abaixo dela ao mesmo tempo.
const PRIVATE_PATHS = [
  "/dashboard",
  "/appointments",
  "/audit",
  "/book",
  "/evolutions",
  "/financial",
  "/insurances",
  "/my-patients",
  "/my-schedule",
  "/patients",
  "/professionals",
  "/profile",
  "/reports",
  "/requests",
  "/settings",
  "/specialties",
  "/team",
  "/users",
  "/waitlist",
  "/cliente",
  "/equipe",
  "/login",
  "/signup",
  "/auth",
];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = SITE_URL;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: PRIVATE_PATHS,
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
