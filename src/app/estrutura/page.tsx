import Link from "next/link";
import { getPublicWebsiteData } from "@/lib/public-queries";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { ScrollReveal } from "@/components/public/ScrollReveal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export const metadata = {
  title: "Estrutura e Tecnologia — Clínica Zoe",
  description: "Conheça nossas instalações modernas, salas de atendimento e tecnologia médica.",
};

export default async function EstruturaPage() {
  const { clinic } = await getPublicWebsiteData();

  return (
    <div className="min-h-screen bg-[#081C15] text-[#F5F7F6] flex flex-col font-sans selection:bg-[#2E8B57] selection:text-white">
      <PublicHeader clinicName={clinic.name} />

      <main className="flex-1 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-20">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <ScrollReveal animation="fade-up">
              <Badge tone="premium">Infraestrutura Hospitalar</Badge>
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-2">
                Estrutura & Tecnologia
              </h1>
              <p className="text-base text-[#C8D4CF] leading-relaxed">
                Ambientes projetados para garantir segurança sanitária, privacidade e o máximo conforto durante a sua consulta.
              </p>
            </ScrollReveal>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <ScrollReveal animation="slide-left">
              <div className="rounded-3xl border border-[#255044] bg-[#102A22] p-8 shadow-lg space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#17382D] text-[#5ED39D] border border-[#255044]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                    <line x1="3" x2="21" y1="9" y2="9" />
                    <line x1="9" x2="9" y1="21" y2="9" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white">Consultórios Climatizados & Acústicos</h3>
                <p className="text-xs sm:text-sm text-[#C8D4CF] leading-relaxed">
                  Salas amplas com isolamento acústico total para sigilo e conforto do diálogo entre médico e paciente.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal animation="slide-right">
              <div className="rounded-3xl border border-[#255044] bg-[#102A22] p-8 shadow-lg space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#17382D] text-[#5ED39D] border border-[#255044]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white">Central Diagnóstica Integrada</h3>
                <p className="text-xs sm:text-sm text-[#C8D4CF] leading-relaxed">
                  Equipamentos modernos para exames de triagem e diagnósticos rápidos no próprio complexo.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal animation="slide-left">
              <div className="rounded-3xl border border-[#255044] bg-[#102A22] p-8 shadow-lg space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#17382D] text-[#5ED39D] border border-[#255044]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white">Biossegurança e Esterilização Rígida</h3>
                <p className="text-xs sm:text-sm text-[#C8D4CF] leading-relaxed">
                  Controle rigoroso de assepsia seguindo protocolos da Anvisa e órgãos internacionais de saúde.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal animation="slide-right">
              <div className="rounded-3xl border border-[#255044] bg-[#102A22] p-8 shadow-lg space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#17382D] text-[#5ED39D] border border-[#255044]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white">Recepção Premium e Estacionamento</h3>
                <p className="text-xs sm:text-sm text-[#C8D4CF] leading-relaxed">
                  Ambiente receptivo, serviço de valete e acessibilidade universal para pessoas com mobilidade reduzida.
                </p>
              </div>
            </ScrollReveal>
          </div>

          <div className="text-center pt-8 border-t border-[#255044]/60">
            <Link href="/cliente/login">
              <Button size="lg" className="font-bold">
                Agendar sua visita à clínica →
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <PublicFooter clinicName={clinic.name} address={clinic.address} whatsappNumber={clinic.whatsapp_number} />
    </div>
  );
}
