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
  openGraph: {
    title: "Clínica Zoe — Medicina de Excelência",
    description: "Cuidados de saúde com tecnologia, excelência e acolhimento.",
    type: "website",
    locale: "pt_BR",
    siteName: "Clínica Zoe",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "MedicalOrganization",
  name: "Clínica Zoe",
  url: "https://clinicazoe.com.br",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`h-full antialiased scroll-smooth ${geist.variable} ${manrope.variable} ${bricolage.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-text-primary font-sans transition-colors duration-300">
        <ToastProvider>
          <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
        </ToastProvider>
      </body>
    </html>
  );
}


