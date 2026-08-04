import Link from "next/link";
import { getPublicWebsiteData } from "@/lib/public-queries";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { ScrollReveal } from "@/components/public/ScrollReveal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export const metadata = {
  title: "A Clínica — História, Missão e Valores | Clínica Zoe",
  description: "Conheça a trajetória da Clínica Zoe, nossa missão de atendimento humanizado e padrão internacional de saúde.",
};

export default async function ClinicaPage() {
  const { clinic } = await getPublicWebsiteData();

  return (
    <div className="min-h-screen bg-[#081C15] text-[#F5F7F6] flex flex-col font-sans selection:bg-[#2E8B57] selection:text-white">
      <PublicHeader clinicName={clinic.name} />

      <main className="flex-1 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-20">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <ScrollReveal animation="fade-up">
              <Badge tone="premium">Institucional</Badge>
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-2">
                A Clínica Zoe
              </h1>
              <p className="text-base text-[#C8D4CF] leading-relaxed">
                Inovação, ética e o acolhimento humano no centro de tudo que fazemos.
              </p>
            </ScrollReveal>
          </div>

          {/* History & Mission */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <ScrollReveal animation="slide-left">
              <div className="space-y-6">
                <Badge tone="success">Nossa História</Badge>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Uma trajetória construída com dedicação e rigor científico
                </h2>
                <p className="text-sm sm:text-base text-[#C8D4CF] leading-relaxed">
                  Fundada com o propósito de transformar a relação entre médicos e pacientes, a Clínica Zoe nasceu para combinar a alta precisão diagnóstica ao conforto e escuta ativa que cada indivíduo merece.
                </p>
                <p className="text-sm sm:text-base text-[#C8D4CF] leading-relaxed">
                  Ao longo dos anos, expandimos nossas especialidades e investimos continuamente na modernização de equipamentos e treinamento de nossa equipe.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal animation="slide-right">
              <div className="rounded-3xl border border-[#255044] bg-[#102A22] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)] space-y-6">
                <div className="p-4 rounded-2xl bg-[#17382D] border border-[#255044]/60">
                  <h3 className="text-base font-bold text-[#5ED39D]">Missão</h3>
                  <p className="text-xs text-[#C8D4CF] mt-1 leading-relaxed">
                    Promover a saúde integral e prevenção personalizada através de condutas baseadas em evidências e atendimento humanizado.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-[#17382D] border border-[#255044]/60">
                  <h3 className="text-base font-bold text-[#5ED39D]">Visão</h3>
                  <p className="text-xs text-[#C8D4CF] mt-1 leading-relaxed">
                    Ser reconhecida como o centro médico modelo em inovação, satisfação do paciente e segurança clínica na região.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-[#17382D] border border-[#255044]/60">
                  <h3 className="text-base font-bold text-[#5ED39D]">Valores</h3>
                  <p className="text-xs text-[#C8D4CF] mt-1 leading-relaxed">
                    Ética inabalável, respeito à vida, transparência total e constante evolução técnica.
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* CTA */}
          <div className="text-center pt-8 border-t border-[#255044]/60">
            <Link href="/cliente/login">
              <Button size="lg" className="font-bold">
                Agendar consulta com nossos especialistas →
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <PublicFooter clinicName={clinic.name} address={clinic.address} whatsappNumber={clinic.whatsapp_number} />
    </div>
  );
}
