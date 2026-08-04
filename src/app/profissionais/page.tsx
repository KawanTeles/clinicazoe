import Link from "next/link";
import { getPublicWebsiteData } from "@/lib/public-queries";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { ScrollReveal } from "@/components/public/ScrollReveal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/whatsapp";

export const metadata = {
  title: "Corpo Médico e Profissionais — Clínica Zoe",
  description: "Conheça nossos médicos especialistas, qualificações, horários e agende sua consulta.",
};

export default async function ProfissionaisPage() {
  const { clinic, professionals } = await getPublicWebsiteData();

  return (
    <div className="min-h-screen bg-[#081C15] text-[#F5F7F6] flex flex-col font-sans selection:bg-[#2E8B57] selection:text-white">
      <PublicHeader clinicName={clinic.name} />

      <main className="flex-1 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <ScrollReveal animation="fade-up">
              <Badge tone="premium">Equipe Médica de Elite</Badge>
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-2">
                Nossos Profissionais
              </h1>
              <p className="text-base text-[#C8D4CF] leading-relaxed">
                Médicos experientes e dedicados a oferecer a melhor assistência à sua saúde.
              </p>
            </ScrollReveal>
          </div>

          {/* Professionals List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {professionals.map((prof, index) => (
              <ScrollReveal key={prof.id} animation="fade-up" delayMs={index * 120}>
                <div className="flex flex-col justify-between rounded-3xl border border-[#255044] bg-[#102A22] p-8 shadow-lg hover:border-[#2E8B57]/60 transition-all h-full">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      {prof.avatarUrl ? (
                        <img
                          src={prof.avatarUrl}
                          alt={prof.fullName}
                          className="h-20 w-20 rounded-2xl object-cover border-2 border-[#255044] shadow-md"
                        />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#17382D] text-2xl font-black text-[#5ED39D] border-2 border-[#255044]">
                          {prof.fullName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h3 className="text-lg font-bold text-white">{prof.fullName}</h3>
                        <Badge tone="success" className="mt-1 text-xs">{prof.specialtyName}</Badge>
                        <p className="text-xs text-[#7A9187] mt-1 font-mono">{prof.licenseNumber}</p>
                      </div>
                    </div>

                    <p className="text-xs text-[#C8D4CF] leading-relaxed">{prof.bio}</p>

                    <div className="p-4 rounded-2xl bg-[#17382D]/70 border border-[#255044]/60 space-y-2 text-xs">
                      <div className="flex justify-between items-center text-[#C8D4CF]">
                        <span>Duração da consulta:</span>
                        <span className="font-bold text-white">{prof.consultationDuration} minutos</span>
                      </div>
                      {prof.priceParticularPix && (
                        <div className="flex justify-between items-center text-[#C8D4CF]">
                          <span>Valor da sessão (Pix):</span>
                          <span className="font-bold text-[#5ED39D]">{formatCurrency(prof.priceParticularPix)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-8 pt-4 border-t border-[#255044]/60 space-y-3">
                    <Link href={`/profissionais/${prof.id}`} className="block w-full">
                      <Button variant="secondary" className="w-full" size="sm">
                        Ver perfil completo
                      </Button>
                    </Link>
                    <Link href="/cliente/login" className="block w-full">
                      <Button className="w-full font-bold" size="sm">
                        Agendar consulta →
                      </Button>
                    </Link>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </main>

      <PublicFooter clinicName={clinic.name} address={clinic.address} whatsappNumber={clinic.whatsapp_number} />
    </div>
  );
}
