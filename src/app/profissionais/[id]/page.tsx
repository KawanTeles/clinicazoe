import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublicWebsiteData } from "@/lib/public-queries";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { ScrollReveal } from "@/components/public/ScrollReveal";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/whatsapp";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { professionals } = await getPublicWebsiteData();
  const prof = professionals.find((p) => p.id === id);
  if (!prof) return { title: "Profissional | Clínica Zoe" };
  return {
    title: `${prof.fullName} — ${prof.specialtyName} | Clínica Zoe`,
    description: prof.bio,
  };
}

export default async function ProfissionalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { clinic, professionals } = await getPublicWebsiteData();
  const prof = professionals.find((p) => p.id === id);

  if (!prof) notFound();

  return (
    <div className="min-h-screen bg-[#081C15] text-[#F5F7F6] flex flex-col font-sans selection:bg-[#2E8B57] selection:text-white">
      <PublicHeader clinicName={clinic.name} />

      <main className="flex-1 py-16 lg:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-12">
          <ScrollReveal animation="fade-up">
            <Link href="/profissionais" className="text-xs font-bold text-[#5ED39D] hover:underline inline-flex items-center gap-1 mb-6">
              ← Voltar para lista de profissionais
            </Link>

            <div className="rounded-3xl border border-[#255044] bg-[#102A22] p-8 sm:p-12 shadow-[0_20px_60px_rgba(0,0,0,0.4)] space-y-8">
              <div className="flex flex-col sm:flex-row items-center gap-8 border-b border-[#255044]/60 pb-8">
                <Avatar src={prof.avatarUrl} name={prof.fullName} size={112} rounded="3xl" className="shadow-xl" />

                <div className="space-y-2 text-center sm:text-left">
                  <Badge tone="premium">{prof.specialtyName}</Badge>
                  <h1 className="text-2xl sm:text-3xl font-black text-white">{prof.fullName}</h1>
                  <p className="text-xs font-mono text-[#7A9187]">{prof.licenseNumber}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Sobre o Profissional</h3>
                  <p className="text-sm text-[#C8D4CF] leading-relaxed">{prof.bio}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#255044]/60">
                  <div className="p-4 rounded-2xl bg-[#17382D]/70 border border-[#255044]/60">
                    <span className="text-xs text-[#7A9187]">Duração Média da Consulta</span>
                    <p className="text-base font-bold text-white mt-1">{prof.consultationDuration} minutos</p>
                  </div>
                  {prof.priceParticularPix && (
                    <div className="p-4 rounded-2xl bg-[#17382D]/70 border border-[#255044]/60">
                      <span className="text-xs text-[#7A9187]">Valor Particular (Pix)</span>
                      <p className="text-base font-bold text-[#5ED39D] mt-1">{formatCurrency(prof.priceParticularPix)}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-[#255044]/60 text-center">
                <Link href="/cliente/login">
                  <Button size="lg" className="w-full sm:w-auto font-bold px-8 py-4">
                    Agendar consulta com {prof.fullName} →
                  </Button>
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
