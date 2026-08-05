import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialog";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
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
    <html lang="pt-BR" className={`h-full antialiased scroll-smooth ${geist.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#081C15] text-[#F5F7F6] font-sans">
        <ToastProvider>
          <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
        </ToastProvider>
      </body>
    </html>
  );
}

