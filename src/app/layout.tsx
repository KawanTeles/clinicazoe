import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Manrope } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialog";
import { getSiteMetadataForLayout } from "@/lib/public-queries";
import { SITE_URL } from "@/lib/site-url";
import { safeJsonLd } from "@/lib/json-ld";

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

const FALLBACK_NAME = "Espaço Zoe";
const buildDescription = (name: string) =>
  `${name}: atendimento médico humanizado com tecnologia de ponta, corpo clínico especializado e agendamento de atendimentos 100% online, rápido e seguro.`;

export async function generateMetadata(): Promise<Metadata> {
  const { clinic } = await getSiteMetadataForLayout();
  const name = clinic?.name || FALLBACK_NAME;
  const DESCRIPTION = buildDescription(name);

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${name} — Medicina de Excelência e Saúde Integrada`,
      template: `%s | ${name}`,
    },
    description: DESCRIPTION,
    keywords: ["clínica médica", "agendamento médico", "atendimentos online", "especialistas de saúde", name],
    authors: [{ name }],
    creator: name,
    publisher: name,
    formatDetection: { email: false, address: false, telephone: false },
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
      url: SITE_URL,
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
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
    },
  };
}

import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AnimationProvider } from "@/components/animation/AnimationProvider";

const SCHEMA_WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { clinic, specialtyNames } = await getSiteMetadataForLayout();
  const name = clinic?.name || FALLBACK_NAME;
  const DESCRIPTION = buildDescription(name);

  const openingHours = (clinic?.business_hours ?? [])
    .filter((entry) => entry.is_open)
    .map((entry) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${SCHEMA_WEEKDAYS[entry.day]}`,
      opens: entry.open_time,
      closes: entry.close_time,
    }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["MedicalClinic", "MedicalBusiness"],
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
    ...(clinic?.latitude != null && clinic?.longitude != null
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: clinic.latitude,
            longitude: clinic.longitude,
          },
          hasMap: clinic?.maps_url || `https://maps.google.com/?q=${clinic.latitude},${clinic.longitude}`,
        }
      : {}),
    ...(openingHours.length > 0 ? { openingHoursSpecification: openingHours } : {}),
    medicalSpecialty: specialtyNames.length > 0 ? specialtyNames : ["GeneralPractice"],
    availableService: {
      "@type": "MedicalProcedure",
      name: "Atendimentos Médicos Especializados",
    },
    sameAs: [clinic?.instagram_url, clinic?.facebook_url, clinic?.linkedin_url, clinic?.youtube_url].filter(
      (url): url is string => Boolean(url),
    ),
  };

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url: SITE_URL,
    inLanguage: "pt-BR",
    publisher: { "@type": "MedicalClinic", name },
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
          dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(websiteJsonLd) }}
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
