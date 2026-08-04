import Link from "next/link";
import { getPublicWebsiteData } from "@/lib/public-queries";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { ScrollReveal } from "@/components/public/ScrollReveal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export const metadata = {
  title: "Especialidades Médicas — Clínica Zoe",
  description: "Conheça todas as especialidades atendidas na Clínica Zoe por nosso corpo médico.",
};

export default async function EspecialidadesPage() {
  const { clinic, specialties, professionals } = await getPublicWebsiteData();

  return (
    <div className="min-h-screen bg-[#081C15] text-[#F5F7F6] flex flex-col font-sans selection:bg-[#2E8B57] selection:text-white">
      <PublicHeader clinicName={clinic.name} />

      <main className="flex-1 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <ScrollReveal animation="fade-up">
              <Badge tone="premium">Áreas de Atuação</Badge>
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-2">
                Especialidades Médicas
              </h1>
              <p className="text-base text-[#C8D4CF] leading-relaxed">
                Cuidados especializados e tratamentos personalizados para sua saúde integral.
              </p>
            </ScrollReveal>
          </div>

          {/* Specialties Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {specialties.map((spec, index) => {
              const relatedProfs = professionals.filter((p) => p.specialtyName === spec.name);

              return (
                <ScrollReveal key={spec.id} animation="fade-up" delayMs={index * 100}>
                  <div className="flex flex-col justify-between rounded-3xl border border-[#255044] bg-[#102A22] p-8 shadow-lg hover:border-[#2E8B57]/60 transition-all h-full">
                    <div className="space-y-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#17382D] text-[#5ED39D] border border-[#255044]">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-white">{spec.name}</h3>
                      <p className="text-xs text-[#C8D4CF] leading-relaxed">
                        Atendimento preventivo, diagnóstico avançado e acompanhamento personalizado nesta especialidade.
                      </p>

                      {relatedProfs.length > 0 && (
                        <div className="pt-3 border-t border-[#255044]/60">
                          <span className="text-[11px] font-bold text-[#7A9187] uppercase tracking-wider">
                            Médicos desta área:
                          </span>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {relatedProfs.map((p) => (
                              <Badge key={p.id} tone="neutral" className="text-[11px]">
                                {p.fullName}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-8 pt-4 border-t border-[#255044]/60">
                      <Link href="/cliente/login" className="block w-full">
                        <Button className="w-full font-bold" size="sm">
                          Agendar nesta especialidade →
                        </Button>
                      </Link>
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </main>

      <PublicFooter clinicName={clinic.name} address={clinic.address} whatsappNumber={clinic.whatsapp_number} />
    </div>
  );
}
