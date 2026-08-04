import Link from "next/link";
import { getPublicWebsiteData } from "@/lib/public-queries";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { LocationSection } from "@/components/public/LocationSection";
import { ScrollReveal } from "@/components/public/ScrollReveal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export const metadata = {
  title: "Clínica Zoe — Medicina de Alta Performance e Saúde Integrada",
  description:
    "Referência em atendimento médico de excelência, corpo clínico renomado e tecnologia de ponta.",
};

export default async function HomePage() {
  const { clinic, specialties, professionals } = await getPublicWebsiteData();

  return (
    <div className="min-h-screen bg-[#081C15] text-[#F5F7F6] flex flex-col font-sans selection:bg-[#2E8B57] selection:text-white">
      <PublicHeader clinicName={clinic.name} />

      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-16 pb-24 lg:pt-24 lg:pb-36 bg-gradient-forest-subtle">
        {/* Ambient Glow */}
        <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-[#2E8B57]/15 blur-[130px]" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column Content */}
            <div className="lg:col-span-7 space-y-6">
              <ScrollReveal animation="fade-up" delayMs={100}>
                <Badge tone="premium" className="px-4 py-1 text-xs font-bold">
                  ✦ Referência em Medicina Integrada e Alta Complexidade
                </Badge>
              </ScrollReveal>

              <ScrollReveal animation="fade-up" delayMs={200}>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.12]">
                  Cuidados de saúde com{" "}
                  <span className="bg-gradient-to-r from-[#5ED39D] via-[#3BAF75] to-[#2E8B57] bg-clip-text text-transparent">
                    tecnologia, excelência
                  </span>{" "}
                  e acolhimento.
                </h1>
              </ScrollReveal>

              <ScrollReveal animation="fade-up" delayMs={300}>
                <p className="text-base sm:text-lg text-[#C8D4CF] leading-relaxed max-w-2xl">
                  Na Clínica Zoe, aliamos a mais avançada tecnologia médica a uma equipe de
                  especialistas de renome para oferecer diagnóstico preciso, tratamento eficaz e
                  atendimento verdadeiramente humanizado.
                </p>
              </ScrollReveal>

              <ScrollReveal animation="fade-up" delayMs={400}>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4">
                  <Link href="/cliente/login">
                    <Button size="lg" className="w-full sm:w-auto shadow-[0_12px_35px_rgba(20,90,67,0.4)] font-bold">
                      Agendar consulta
                    </Button>
                  </Link>
                  <Link href="/profissionais">
                    <Button variant="secondary" size="lg" className="w-full sm:w-auto font-semibold">
                      Conhecer corpo médico
                    </Button>
                  </Link>
                </div>
              </ScrollReveal>

              {/* Statistics */}
              <ScrollReveal animation="fade-up" delayMs={500}>
                <div className="pt-10 border-t border-[#255044]/60 grid grid-cols-3 gap-6">
                  <div>
                    <p className="text-2xl sm:text-3xl font-black text-[#5ED39D]">99.8%</p>
                    <p className="text-xs text-[#7A9187] mt-1 font-medium">Satisfação dos pacientes</p>
                  </div>
                  <div>
                    <p className="text-2xl sm:text-3xl font-black text-[#5ED39D]">+20k</p>
                    <p className="text-xs text-[#7A9187] mt-1 font-medium">Atendimentos realizados</p>
                  </div>
                  <div>
                    <p className="text-2xl sm:text-3xl font-black text-[#5ED39D]">100%</p>
                    <p className="text-xs text-[#7A9187] mt-1 font-medium">Especialistas certificados</p>
                  </div>
                </div>
              </ScrollReveal>
            </div>

            {/* Right Column Visual Graphic */}
            <div className="lg:col-span-5 relative">
              <ScrollReveal animation="blur-reveal" delayMs={300}>
                <div className="relative mx-auto max-w-md rounded-3xl border border-[#255044] bg-[#102A22] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
                  <div className="flex items-center gap-4 border-b border-[#255044]/60 pb-6 mb-6">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#17382D] text-[#5ED39D] border border-[#255044] shadow-inner">
                      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase text-[#5ED39D]">Centro Médico Integrado</span>
                      <h3 className="text-xl font-extrabold text-[#F5F7F6]">Padrão Internacional</h3>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-[#17382D]/60 border border-[#255044]/50">
                      <h4 className="text-sm font-bold text-white">Consultas Presenciais & Telemedicina</h4>
                      <p className="text-xs text-[#C8D4CF] mt-1">Flexibilidade e comodidade com suporte completo.</p>
                    </div>
                    <div className="p-4 rounded-xl bg-[#17382D]/60 border border-[#255044]/50">
                      <h4 className="text-sm font-bold text-white">Prontuário Digital Criptografado</h4>
                      <p className="text-xs text-[#C8D4CF] mt-1">Segurança de dados e acesso instantâneo ao seu histórico.</p>
                    </div>
                    <div className="p-4 rounded-xl bg-[#17382D]/60 border border-[#255044]/50">
                      <h4 className="text-sm font-bold text-white">Principais Convênios Aceitos</h4>
                      <p className="text-xs text-[#C8D4CF] mt-1">Ampla cobertura e faciidades para plano e particular.</p>
                    </div>
                  </div>

                  <div className="mt-8">
                    <Link href="/cliente/login" className="block w-full">
                      <Button className="w-full font-bold">Agendar consulta online →</Button>
                    </Link>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO DIFERENCIAIS DA CLÍNICA */}
      <section className="py-24 border-t border-[#255044]/60 bg-[#081C15]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <ScrollReveal animation="fade-up">
              <Badge tone="success">Excelência Médica</Badge>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#F5F7F6] mt-2">
                Diferenciais que garantem sua tranquilidade
              </h2>
              <p className="text-sm sm:text-base text-[#C8D4CF]">
                Compromisso com o cuidado contínuo, diagnósticos ágeis e ambiente acolhedor.
              </p>
            </ScrollReveal>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <ScrollReveal animation="fade-up" delayMs={100}>
              <div className="rounded-2xl border border-[#255044] bg-[#102A22] p-8 shadow-lg hover:border-[#2E8B57]/50 transition-all h-full flex flex-col justify-between">
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#17382D] text-[#5ED39D] border border-[#255044] mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-[#F5F7F6]">Atendimento Humanizado</h3>
                  <p className="mt-3 text-xs sm:text-sm text-[#C8D4CF] leading-relaxed">
                    Consultas individuais estendidas, sem correria, focadas no histórico biológico, estilo de vida e necessidades do paciente.
                  </p>
                </div>
                <Link href="/clinica" className="mt-6 text-xs font-bold text-[#5ED39D] hover:underline inline-flex items-center gap-1">
                  Saiba mais sobre a clínica →
                </Link>
              </div>
            </ScrollReveal>

            <ScrollReveal animation="fade-up" delayMs={200}>
              <div className="rounded-2xl border border-[#255044] bg-[#102A22] p-8 shadow-lg hover:border-[#2E8B57]/50 transition-all h-full flex flex-col justify-between">
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#17382D] text-[#5ED39D] border border-[#255044] mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-[#F5F7F6]">Tecnologia Diagnóstica</h3>
                  <p className="mt-3 text-xs sm:text-sm text-[#C8D4CF] leading-relaxed">
                    Equipamentos modernos e parcerias com laboratórios de ponta para respostas rápidas e precisas.
                  </p>
                </div>
                <Link href="/estrutura" className="mt-6 text-xs font-bold text-[#5ED39D] hover:underline inline-flex items-center gap-1">
                  Conhecer nossa estrutura →
                </Link>
              </div>
            </ScrollReveal>

            <ScrollReveal animation="fade-up" delayMs={300}>
              <div className="rounded-2xl border border-[#255044] bg-[#102A22] p-8 shadow-lg hover:border-[#2E8B57]/50 transition-all h-full flex flex-col justify-between">
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#17382D] text-[#5ED39D] border border-[#255044] mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-[#F5F7F6]">Corpo Clínico Qualificado</h3>
                  <p className="mt-3 text-xs sm:text-sm text-[#C8D4CF] leading-relaxed">
                    Médicos com titulação de especialistas, atuação em hospitais renomados e constante atualização científica.
                  </p>
                </div>
                <Link href="/profissionais" className="mt-6 text-xs font-bold text-[#5ED39D] hover:underline inline-flex items-center gap-1">
                  Ver corpo médico completo →
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* SEÇÃO PREVIEW ESPECIALIDADES */}
      <section className="py-24 border-t border-[#255044]/60 bg-[#102A22]/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <ScrollReveal animation="slide-left">
              <Badge tone="premium">Especialidades Médicas</Badge>
              <h2 className="text-3xl font-extrabold text-[#F5F7F6] mt-2">
                Atendimento integral para todas as idades
              </h2>
            </ScrollReveal>
            <ScrollReveal animation="slide-right">
              <Link href="/especialidades">
                <Button variant="secondary" size="sm">
                  Ver todas as especialidades →
                </Button>
              </Link>
            </ScrollReveal>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {specialties.slice(0, 4).map((spec, index) => (
              <ScrollReveal key={spec.id} animation="fade-up" delayMs={index * 100}>
                <div className="group flex flex-col justify-between rounded-2xl border border-[#255044] bg-[#102A22] p-6 hover:border-[#2E8B57] hover:bg-[#17382D]/80 transition-all">
                  <div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#17382D] text-[#5ED39D] border border-[#255044] group-hover:scale-110 transition-transform mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                      </svg>
                    </div>
                    <h3 className="text-base font-bold text-[#F5F7F6] group-hover:text-[#5ED39D] transition-colors">
                      {spec.name}
                    </h3>
                    <p className="mt-1 text-xs text-[#7A9187]">Atendimento presencial e online</p>
                  </div>
                  <Link href="/especialidades" className="mt-6 text-xs font-bold text-[#5ED39D] hover:underline inline-flex items-center gap-1">
                    Ver detalhes →
                  </Link>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* SEÇÃO PREVIEW PROFISSIONAIS */}
      <section className="py-24 border-t border-[#255044]/60 bg-[#081C15]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <ScrollReveal animation="fade-up">
              <Badge tone="success">Corpo Médico</Badge>
              <h2 className="text-3xl font-extrabold text-[#F5F7F6]">
                Conheça nossos médicos
              </h2>
              <p className="text-sm text-[#C8D4CF]">
                Profissionais qualificados prontos para acolher você e sua família.
              </p>
            </ScrollReveal>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {professionals.slice(0, 3).map((prof, index) => (
              <ScrollReveal key={prof.id} animation="fade-up" delayMs={index * 150}>
                <div className="group flex flex-col justify-between rounded-2xl border border-[#255044] bg-[#102A22] p-6 shadow-lg hover:border-[#2E8B57]/60 transition-all">
                  <div>
                    <div className="flex items-center gap-4 mb-4">
                      {prof.avatarUrl ? (
                        <img
                          src={prof.avatarUrl}
                          alt={prof.fullName}
                          className="h-16 w-16 rounded-2xl object-cover border border-[#255044]"
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#17382D] text-lg font-extrabold text-[#5ED39D] border border-[#255044]">
                          {prof.fullName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h3 className="text-base font-bold text-[#F5F7F6]">{prof.fullName}</h3>
                        <Badge tone="premium" className="mt-1 text-[11px]">{prof.specialtyName}</Badge>
                        <p className="text-[11px] text-[#7A9187] mt-1">{prof.licenseNumber}</p>
                      </div>
                    </div>
                    <p className="text-xs text-[#C8D4CF] leading-relaxed line-clamp-3">{prof.bio}</p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#255044]/60">
                    <Link href={`/profissionais/${prof.id}`} className="block w-full">
                      <Button variant="secondary" size="sm" className="w-full">
                        Ver perfil do médico
                      </Button>
                    </Link>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <div className="text-center pt-4">
            <Link href="/profissionais">
              <Button size="lg" variant="secondary">
                Ver todos os profissionais →
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="py-20 border-t border-[#255044]/60 bg-gradient-forest-subtle relative overflow-hidden">
        <div className="mx-auto max-w-5xl px-4 text-center space-y-6 relative z-10">
          <ScrollReveal animation="fade-up">
            <Badge tone="premium">Atendimento Prioritário</Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2">
              Pronto para agendar sua consulta?
            </h2>
            <p className="text-sm sm:text-base text-[#C8D4CF] max-w-xl mx-auto">
              Acesse a área do cliente em poucos segundos para escolher o melhor dia e horário para o seu atendimento.
            </p>
            <div className="pt-6">
              <Link href="/cliente/login">
                <Button size="lg" className="px-8 py-4 text-base font-bold shadow-[0_12px_40px_rgba(20,90,67,0.5)]">
                  Ir para a Área do Paciente →
                </Button>
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* SEÇÃO COMO CHEGAR / LOCALIZAÇÃO */}
      <LocationSection
        clinicName={clinic.name}
        address={clinic.address}
        whatsappNumber={clinic.whatsapp_number}
      />

      <PublicFooter clinicName={clinic.name} address={clinic.address} whatsappNumber={clinic.whatsapp_number} />
    </div>
  );
}
