import Link from "next/link";
import { getPublicWebsiteData } from "@/lib/public-queries";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { LocationSection } from "@/components/public/LocationSection";
import { ScrollReveal } from "@/components/public/ScrollReveal";
import { Avatar } from "@/components/ui/Avatar";
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
    <div className="min-h-screen bg-background text-text-primary flex flex-col font-sans selection:bg-primary selection:text-white">
      <PublicHeader clinicName={clinic.name} />

      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-16 pb-24 lg:pt-24 lg:pb-36 bg-gradient-forest-subtle">
        {/* Ambient Glow - Controlled 25% reduced intensity for clear contrast */}
        <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[420px] w-[420px] rounded-full bg-primary/10 blur-[140px]" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column Content */}
            <div className="lg:col-span-7 space-y-6">
              <ScrollReveal animation="fade-up" delayMs={100}>
                <Badge tone="premium" className="px-4 py-1.5 text-xs font-bold border border-[rgba(110,231,183,0.3)] shadow-[0_0_15px_rgba(46,139,87,0.2)]">
                  ✦ Referência em Medicina Integrada e Alta Complexidade
                </Badge>
              </ScrollReveal>

              <ScrollReveal animation="fade-up" delayMs={200}>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.12] font-heading">
                  Cuidados de saúde com{" "}
                  <span className="bg-gradient-to-r from-[#6EE7B7] via-[#5ED39D] to-[#2E8B57] bg-clip-text text-transparent drop-shadow-sm">
                    tecnologia, excelência
                  </span>{" "}
                  e acolhimento.
                </h1>
              </ScrollReveal>

              <ScrollReveal animation="fade-up" delayMs={300}>
                <p className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-2xl font-normal">
                  Na Clínica Zoe, aliamos a mais avançada tecnologia médica a uma equipe de
                  especialistas de renome para oferecer diagnóstico preciso, tratamento eficaz e
                  atendimento verdadeiramente humanizado.
                </p>
              </ScrollReveal>

              <ScrollReveal animation="fade-up" delayMs={400}>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4">
                  <Link href="/cliente/login">
                    <Button
                      size="lg"
                      withArrow
                      className="w-full sm:w-auto font-bold shadow-[0_12px_35px_rgba(46,139,87,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-[0_16px_40px_rgba(46,139,87,0.45)]"
                    >
                      Agendar consulta
                    </Button>
                  </Link>
                  <Link href="/profissionais">
                    <Button
                      variant="secondary"
                      size="lg"
                      className="w-full sm:w-auto font-bold border border-border/80 hover:border-primary/60 transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02]"
                    >
                      Conhecer corpo médico
                    </Button>
                  </Link>
                </div>
              </ScrollReveal>

              {/* Statistics */}
              <ScrollReveal animation="fade-up" delayMs={500}>
                <div className="pt-10 border-t border-border/70 grid grid-cols-3 gap-6">
                  <div>
                    <p className="text-2xl sm:text-3xl font-black text-[#6EE7B7] font-heading drop-shadow-[0_2px_10px_rgba(110,231,183,0.2)]">99.8%</p>
                    <p className="text-xs text-text-secondary mt-1 font-medium">Satisfação dos pacientes</p>
                  </div>
                  <div>
                    <p className="text-2xl sm:text-3xl font-black text-[#6EE7B7] font-heading drop-shadow-[0_2px_10px_rgba(110,231,183,0.2)]">+20k</p>
                    <p className="text-xs text-text-secondary mt-1 font-medium">Atendimentos realizados</p>
                  </div>
                  <div>
                    <p className="text-2xl sm:text-3xl font-black text-[#6EE7B7] font-heading drop-shadow-[0_2px_10px_rgba(110,231,183,0.2)]">100%</p>
                    <p className="text-xs text-text-secondary mt-1 font-medium">Especialistas certificados</p>
                  </div>
                </div>
              </ScrollReveal>
            </div>

            {/* Right Column Visual Graphic */}
            <div className="lg:col-span-5 relative">
              <ScrollReveal animation="blur-reveal" delayMs={300}>
                {/* Outer shell */}
                <div className="relative mx-auto max-w-md rounded-[2rem] border border-[rgba(110,231,183,0.18)] bg-card/80 p-2.5 shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-300 hover:border-[rgba(110,231,183,0.35)] hover:shadow-card-hover group">
                  {/* Inner core */}
                  <div className="rounded-[calc(2rem-0.5rem)] border border-border/80 bg-card-elevated/90 p-7 shadow-inner space-y-6">
                    <div className="flex items-center gap-4 border-b border-border/70 pb-6">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-[#6EE7B7] border border-[rgba(110,231,183,0.3)] shadow-[0_0_20px_rgba(110,231,183,0.2)] transition-transform duration-300 group-hover:scale-105">
                        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                        </svg>
                      </div>
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-[#6EE7B7]">Centro Médico Integrado</span>
                        <h3 className="text-xl font-extrabold text-white font-heading mt-0.5">Padrão Internacional</h3>
                      </div>
                    </div>

                    <div className="space-y-3.5">
                      <div className="group/item rounded-xl border border-[rgba(110,231,183,0.15)] bg-card/60 p-4 transition-all duration-300 hover:border-[rgba(110,231,183,0.35)] hover:bg-card/90 hover:translate-x-1 hover:shadow-md">
                        <h4 className="text-sm font-bold text-white group-hover/item:text-[#6EE7B7] transition-colors">Consultas Presenciais & Telemedicina</h4>
                        <p className="text-xs text-text-secondary mt-1 leading-relaxed">Flexibilidade e comodidade com suporte completo.</p>
                      </div>
                      <div className="group/item rounded-xl border border-[rgba(110,231,183,0.15)] bg-card/60 p-4 transition-all duration-300 hover:border-[rgba(110,231,183,0.35)] hover:bg-card/90 hover:translate-x-1 hover:shadow-md">
                        <h4 className="text-sm font-bold text-white group-hover/item:text-[#6EE7B7] transition-colors">Prontuário Digital Criptografado</h4>
                        <p className="text-xs text-text-secondary mt-1 leading-relaxed">Segurança de dados e acesso instantâneo ao seu histórico.</p>
                      </div>
                      <div className="group/item rounded-xl border border-[rgba(110,231,183,0.15)] bg-card/60 p-4 transition-all duration-300 hover:border-[rgba(110,231,183,0.35)] hover:bg-card/90 hover:translate-x-1 hover:shadow-md">
                        <h4 className="text-sm font-bold text-white group-hover/item:text-[#6EE7B7] transition-colors">Principais Convênios Aceitos</h4>
                        <p className="text-xs text-text-secondary mt-1 leading-relaxed">Ampla cobertura e facilidades para plano e particular.</p>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Link href="/cliente/login" className="block w-full">
                        <Button withArrow className="w-full font-bold shadow-[0_8px_25px_rgba(46,139,87,0.3)] hover:scale-[1.01]">Agendar consulta online</Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO DIFERENCIAIS DA CLÍNICA */}
      <section className="py-24 border-t border-border/70 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <ScrollReveal animation="fade-up">
              <Badge tone="success" className="border border-[rgba(110,231,183,0.25)] shadow-sm">Excelência Médica</Badge>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2 font-heading">
                Diferenciais que garantem sua tranquilidade
              </h2>
              <p className="text-sm sm:text-base text-text-secondary">
                Compromisso com o cuidado contínuo, diagnósticos ágeis e ambiente acolhedor.
              </p>
            </ScrollReveal>
          </div>

          {/* Bento grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <ScrollReveal animation="fade-up" delayMs={100} className="lg:col-span-7 lg:row-span-2">
              <div className="rounded-[1.75rem] border border-[rgba(110,231,183,0.18)] bg-card/80 p-2 h-full shadow-card backdrop-blur-md">
                <div className="rounded-[calc(1.75rem-0.375rem)] border border-border/80 bg-card-elevated/90 p-8 lg:p-10 shadow-inner hover:border-[rgba(110,231,183,0.35)] transition-all duration-300 ease-[var(--ease-premium)] h-full flex flex-col justify-between group">
                  <div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-card text-[#6EE7B7] border border-[rgba(110,231,183,0.3)] shadow-[0_0_15px_rgba(110,231,183,0.18)] mb-6 transition-transform duration-300 group-hover:scale-110">
                      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-white font-heading">Atendimento Humanizado</h3>
                    <p className="mt-3 text-sm text-text-secondary leading-relaxed max-w-md">
                      Consultas individuais estendidas, sem correria, focadas no histórico biológico, estilo de vida e necessidades do paciente. Uma experiência de cuidado pensada em cada detalhe.
                    </p>
                  </div>
                  <Link href="/clinica" className="mt-8 text-xs font-bold text-[#6EE7B7] hover:underline inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Saiba mais sobre a clínica →
                  </Link>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal animation="fade-up" delayMs={200} className="lg:col-span-5">
              <div className="group rounded-2xl border border-[rgba(110,231,183,0.18)] bg-card p-6 sm:p-7 shadow-card hover:border-[rgba(110,231,183,0.35)] hover:-translate-y-1 transition-all duration-300 ease-[var(--ease-premium)] h-full flex items-center gap-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card-elevated text-[#6EE7B7] border border-[rgba(110,231,183,0.3)] shadow-[0_0_15px_rgba(110,231,183,0.15)] group-hover:scale-105 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-heading">Tecnologia Diagnóstica</h3>
                  <p className="mt-1.5 text-xs text-text-secondary leading-relaxed">
                    Equipamentos modernos e laboratórios de ponta para respostas rápidas.
                  </p>
                  <Link href="/estrutura" className="mt-3 text-xs font-bold text-[#6EE7B7] hover:underline inline-flex items-center gap-1">
                    Conhecer estrutura →
                  </Link>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal animation="fade-up" delayMs={300} className="lg:col-span-5">
              <div className="group rounded-2xl border border-[rgba(110,231,183,0.18)] bg-card p-6 sm:p-7 shadow-card hover:border-[rgba(110,231,183,0.35)] hover:-translate-y-1 transition-all duration-300 ease-[var(--ease-premium)] h-full flex items-center gap-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card-elevated text-[#6EE7B7] border border-[rgba(110,231,183,0.3)] shadow-[0_0_15px_rgba(110,231,183,0.15)] group-hover:scale-105 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-heading">Corpo Clínico Qualificado</h3>
                  <p className="mt-1.5 text-xs text-text-secondary leading-relaxed">
                    Especialistas com atuação em hospitais renomados.
                  </p>
                  <Link href="/profissionais" className="mt-3 text-xs font-bold text-[#6EE7B7] hover:underline inline-flex items-center gap-1">
                    Ver corpo médico →
                  </Link>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* SEÇÃO PREVIEW ESPECIALIDADES */}
      <section className="py-24 border-t border-border/70 bg-surface/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <ScrollReveal animation="slide-left">
              <Badge tone="premium" className="border border-[rgba(110,231,183,0.3)]">Especialidades Médicas</Badge>
              <h2 className="text-3xl font-extrabold text-white mt-2 font-heading">
                Atendimento integral para todas as idades
              </h2>
            </ScrollReveal>
            <ScrollReveal animation="slide-right">
              <Link href="/especialidades">
                <Button variant="secondary" size="sm" withArrow className="font-bold border border-border/80 hover:border-primary/60">
                  Ver todas as especialidades
                </Button>
              </Link>
            </ScrollReveal>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {specialties.slice(0, 4).map((spec, index) => (
              <ScrollReveal key={spec.id} animation="fade-up" delayMs={index * 100}>
                <div className="group flex flex-col justify-between rounded-2xl border border-[rgba(110,231,183,0.18)] bg-card p-6 shadow-card hover:-translate-y-1 hover:border-[rgba(110,231,183,0.35)] hover:shadow-card-hover transition-all duration-300">
                  <div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card-elevated text-[#6EE7B7] border border-[rgba(110,231,183,0.25)] group-hover:scale-110 transition-transform mb-4 shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                      </svg>
                    </div>
                    <h3 className="text-base font-bold text-white group-hover:text-[#6EE7B7] transition-colors font-heading">
                      {spec.name}
                    </h3>
                    <p className="mt-1 text-xs text-text-secondary">Atendimento presencial e online</p>
                  </div>
                  <Link href="/especialidades" className="mt-6 text-xs font-bold text-[#6EE7B7] hover:underline inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Ver detalhes →
                  </Link>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* SEÇÃO PREVIEW PROFISSIONAIS */}
      <section className="py-24 border-t border-border/70 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <ScrollReveal animation="fade-up">
              <Badge tone="success" className="border border-[rgba(110,231,183,0.25)]">Corpo Médico</Badge>
              <h2 className="text-3xl font-extrabold text-white font-heading">
                Conheça nossos médicos
              </h2>
              <p className="text-sm text-text-secondary">
                Profissionais qualificados prontos para acolher você e sua família.
              </p>
            </ScrollReveal>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {professionals.slice(0, 3).map((prof, index) => (
              <ScrollReveal key={prof.id} animation="fade-up" delayMs={index * 150}>
                <div className="group flex flex-col justify-between rounded-2xl border border-[rgba(110,231,183,0.18)] bg-card p-6 shadow-card hover:-translate-y-1 hover:border-[rgba(110,231,183,0.35)] hover:shadow-card-hover transition-all duration-300">
                  <div>
                    <div className="flex items-center gap-4 mb-4">
                      <Avatar src={prof.avatarUrl} name={prof.fullName} size={64} rounded="2xl" />
                      <div>
                        <h3 className="text-base font-bold text-white font-heading">{prof.fullName}</h3>
                        <Badge tone="premium" className="mt-1 text-[11px] border border-[rgba(110,231,183,0.25)]">{prof.specialtyName}</Badge>
                        <p className="text-[11px] text-text-muted mt-1 font-mono">{prof.licenseNumber}</p>
                      </div>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">{prof.bio}</p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-border/70">
                    <Link href={`/profissionais/${prof.id}`} className="block w-full">
                      <Button variant="secondary" size="sm" className="w-full font-bold border border-border/80 hover:border-primary/60">
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
              <Button size="lg" variant="secondary" withArrow className="font-bold border border-border/80 hover:border-primary/60">
                Ver todos os profissionais
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="py-20 border-t border-border/70 bg-gradient-forest-subtle relative overflow-hidden">
        <div className="mx-auto max-w-5xl px-4 text-center space-y-6 relative z-10">
          <ScrollReveal animation="fade-up">
            <Badge tone="premium" className="border border-[rgba(110,231,183,0.3)] shadow-[0_0_15px_rgba(46,139,87,0.2)]">Atendimento Prioritário</Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2 font-heading">
              Pronto para agendar sua consulta?
            </h2>
            <p className="text-sm sm:text-base text-text-secondary max-w-xl mx-auto">
              Acesse a área do cliente em poucos segundos para escolher o melhor dia e horário para o seu atendimento.
            </p>
            <div className="pt-6">
              <Link href="/cliente/login">
                <Button size="lg" withArrow className="px-8 py-4 text-base font-bold shadow-[0_12px_35px_rgba(46,139,87,0.35)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_16px_40px_rgba(46,139,87,0.45)]">
                  Ir para a Área do Paciente
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
