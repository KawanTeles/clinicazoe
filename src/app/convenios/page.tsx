import Link from "next/link";
import { getPublicWebsiteData } from "@/lib/public-queries";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { ScrollReveal } from "@/components/public/ScrollReveal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export const metadata = {
  title: "Convênios Atendidos — Clínica Zoe",
  description: "Confira a lista de planos de saúde e convênios aceitos na Clínica Zoe.",
};

export default async function ConveniosPage() {
  const { clinic, insurances } = await getPublicWebsiteData();

  return (
    <div className="min-h-screen bg-[#081C15] text-[#F5F7F6] flex flex-col font-sans selection:bg-[#2E8B57] selection:text-white">
      <PublicHeader clinicName={clinic.name} />

      <main className="flex-1 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <ScrollReveal animation="fade-up">
              <Badge tone="premium">Atendimento Facilitado</Badge>
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-2">
                Convênios Aceitos
              </h1>
              <p className="text-base text-[#C8D4CF] leading-relaxed">
                Trabalhamos com os principais planos de saúde do país e também atendimento particular com facilidades.
              </p>
            </ScrollReveal>
          </div>

          {/* Insurances Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {insurances.map((ins, index) => (
              <ScrollReveal key={ins.id} animation="fade-up" delayMs={index * 80}>
                <div className="flex flex-col justify-between rounded-2xl border border-[#255044] bg-[#102A22] p-6 shadow-md hover:border-[#2E8B57]/60 transition-all h-full">
                  <div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#17382D] text-[#5ED39D] border border-[#255044] mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-white">{ins.name}</h3>
                    <p className="text-xs text-[#C8D4CF] mt-2">
                      Cobertura para consultas médicas especializadas na Clínica Zoe.
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#255044]/60">
                    <Link href="/cliente/login" className="block w-full">
                      <Button variant="secondary" size="sm" className="w-full">
                        Agendar por este convênio
                      </Button>
                    </Link>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          {/* Info Card */}
          <ScrollReveal animation="fade-up">
            <div className="rounded-3xl border border-[#255044] bg-[#102A22] p-8 text-center max-w-3xl mx-auto space-y-4">
              <h3 className="text-xl font-bold text-white">Não encontrou seu plano de saúde?</h3>
              <p className="text-xs sm:text-sm text-[#C8D4CF]">
                Atendemos também na modalidade particular com reembolso para diversos convênios. Entre em contato para entender como solicitar seu recibo de reembolso.
              </p>
              <div className="pt-2">
                <Link href="/contato">
                  <Button size="lg" className="font-bold">Falar com nossa equipe →</Button>
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </main>

      <PublicFooter clinicName={clinic.name} address={clinic.address} whatsappNumber={clinic.whatsapp_number} />
    </div>
  );
}
