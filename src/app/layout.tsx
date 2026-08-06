import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Manrope } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialog";

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

export const metadata: Metadata = {
  title: {
    default: "Clínica Zoe — Medicina de Excelência e Saúde Integrada",
    template: "%s | Clínica Zoe",
  },
  description: "Cuidados de saúde com tecnologia, excelência e acolhimento. Agendamento de consultas online rápida e segura.",
  keywords: ["clínica médica", "agendamento médico", "consultas online", "especialistas de saúde", "Clínica Zoe"],
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "Clínica Zoe — Medicina de Excelência",
    description: "Cuidados de saúde com tecnologia, excelência e acolhimento.",
    type: "website",
    locale: "pt_BR",
    siteName: "Clínica Zoe",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Clínica Zoe — Identidade Visual Oficial",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Clínica Zoe — Medicina de Excelência",
    description: "Cuidados de saúde com tecnologia, excelência e acolhimento.",
    images: ["/og-image.png"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "MedicalOrganization",
  name: "Clínica Zoe",
  url: "https://clinicazoe.com.br",
  logo: "https://clinicazoe.com.br/brand-logo.png",
  image: "https://clinicazoe.com.br/og-image.png",
  description: "Cuidados de saúde com tecnologia, excelência e acolhimento.",
  medicalSpecialty: [
    "Cardiology",
    "Dermatology",
    "GeneralPractice",
    "Pediatrics",
    "Orthopedics"
  ],
  availableService: {
    "@type": "MedicalProcedure",
    name: "Consultas Médicas Especializadas",
  },
};

import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AnimationProvider } from "@/components/animation/AnimationProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
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


