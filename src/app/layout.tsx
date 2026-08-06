import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Manrope } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialog";
import { getSiteMetadataForLayout } from "@/lib/public-queries";
import { SITE_URL } from "@/lib/site-url";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const FALLBACK_NAME = "ClinicaZoe";
const DESCRIPTION = "Cuidados de saúde com tecnologia, excelência e acolhimento. Agendamento de consultas online rápida e segura.";

export async function generateMetadata(): Promise<Metadata> {
  const { clinic } = await getSiteMetadataForLayout();
  const name = clinic?.name || FALLBACK_NAME;

  return {
    title: {
      default: `${name} — Medicina de Excelência e Saúde Integrada`,
      template: `%s | ${name}`,
    },
    description: DESCRIPTION,
    keywords: ["clínica médica", "agendamento médico", "consultas online", "especialistas de saúde", name],
    icons: {
      icon: [
        { url: "/favicon.ico" },
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
      shortcut: ["/favicon.ico"],
    },
    manifest: "/site.webmanifest",
    openGraph: {
      title: `${name} — Medicina de Excelência`,
      description: DESCRIPTION,
      type: "website",
      locale: "pt_BR",
      siteName: name,
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: `${name} — Identidade Visual Oficial`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} — Medicina de Excelência`,
      description: DESCRIPTION,
      images: ["/og-image.png"],
    },
  };
}

import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AnimationProvider } from "@/components/animation/AnimationProvider";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { clinic, specialtyNames } = await getSiteMetadataForLayout();
  const name = clinic?.name || FALLBACK_NAME;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalOrganization",
    name,
    ...(clinic?.legal_name ? { legalName: clinic.legal_name } : {}),
    url: SITE_URL,
    logo: clinic?.logo_url || `${SITE_URL}/brand-logo.png`,
    image: `${SITE_URL}/og-image.png`,
    description: DESCRIPTION,
    ...(clinic?.email ? { email: clinic.email } : {}),
    ...(clinic?.phone_primary || clinic?.whatsapp_number
      ? { telephone: clinic.phone_primary || clinic.whatsapp_number }
      : {}),
    ...(clinic?.address_street
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: [clinic.address_street, clinic.address_number].filter(Boolean).join(", "),
            addressLocality: clinic.address_city || undefined,
            addressRegion: clinic.address_state || undefined,
            postalCode: clinic.address_zip || undefined,
            addressCountry: clinic.address_country || "BR",
          },
        }
      : {}),
    medicalSpecialty: specialtyNames.length > 0 ? specialtyNames : ["GeneralPractice"],
    availableService: {
      "@type": "MedicalProcedure",
      name: "Consultas Médicas Especializadas",
    },
    sameAs: [clinic?.instagram_url, clinic?.facebook_url, clinic?.linkedin_url, clinic?.youtube_url].filter(
      (url): url is string => Boolean(url),
    ),
  };

  return (
    <html
      lang="pt-BR"
      className={`h-full antialiased scroll-smooth ${geist.variable} ${manrope.variable} ${bricolage.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('clinicazoe-theme');var t=s||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);document.documentElement.classList.add(t);}catch(e){}})();`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-text-primary font-sans transition-colors duration-300">
        <ThemeProvider>
          <AnimationProvider>
            <ToastProvider>
              <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
            </ToastProvider>
          </AnimationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
