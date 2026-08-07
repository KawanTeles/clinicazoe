import type { ReactElement } from "react";
import Link from "next/link";
import Image from "next/image";
import { DeveloperSignature } from "@/components/public/DeveloperSignature";
import { buildWhatsAppLink, formatWhatsAppDisplay } from "@/lib/whatsapp";

interface SocialMediaLinks {
  instagram?: string | null;
  facebook?: string | null;
  linkedin?: string | null;
  youtube?: string | null;
}

interface PublicFooterProps {
  clinicName: string;
  logoUrl?: string | null;
  address?: string | null;
  whatsappNumber?: string | null;
  email?: string | null;
  phonePrimary?: string | null;
  phoneSecondary?: string | null;
  emergencyPhone?: string | null;
  socialMedia?: SocialMediaLinks;
}

const SOCIAL_ICONS: Array<{ key: keyof SocialMediaLinks; label: string; path: ReactElement }> = [
  {
    key: "instagram",
    label: "Instagram",
    path: (
      <>
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </>
    ),
  },
  {
    key: "facebook",
    label: "Facebook",
    path: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    path: (
      <>
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
        <rect x="2" y="9" width="4" height="12" />
        <circle cx="4" cy="4" r="2" />
      </>
    ),
  },
  {
    key: "youtube",
    label: "YouTube",
    path: (
      <>
        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
        <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
      </>
    ),
  },
];

export function PublicFooter({
  clinicName,
  logoUrl,
  address,
  whatsappNumber,
  email,
  phonePrimary,
  phoneSecondary,
  emergencyPhone,
  socialMedia,
}: PublicFooterProps) {
  const whatsappLink = buildWhatsAppLink(whatsappNumber, `Olá! Vim pelo site da ${clinicName}.`);
  const whatsappDisplay = formatWhatsAppDisplay(whatsappNumber);
  const extraPhones = [phonePrimary, phoneSecondary, emergencyPhone].filter(Boolean) as string[];
  const activeSocials = SOCIAL_ICONS.filter((social) => socialMedia?.[social.key]);

  return (
    <footer className="border-t border-border/80 bg-[var(--bg-footer)] pt-16 pb-8 text-text-secondary">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8">
          {/* Brand Info */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-3">
              <Image
                src={logoUrl || "/brand-logo.png"}
                alt={clinicName}
                width={40}
                height={40}
                className="h-10 w-10 rounded-full object-cover shadow-sm border border-border/50"
              />
              <span className="text-xl font-bold text-text-primary font-heading">{clinicName}</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Excelência em saúde integrada com inovação tecnológica, infraestrutura de alto padrão e cuidado humanizado.
            </p>
            {activeSocials.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                {activeSocials.map((social) => (
                  <a
                    key={social.key}
                    href={socialMedia?.[social.key] ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card-elevated text-text-secondary hover:text-[var(--link)] hover:border-[var(--link)]/50 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {social.path}
                    </svg>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--link)] font-heading mb-4">Navegação</p>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/" className="hover:text-text-primary transition-colors">
                  Início
                </Link>
              </li>
              <li>
                <Link href="/clinica" className="hover:text-text-primary transition-colors">
                  A Clínica
                </Link>
              </li>
              <li>
                <Link href="/especialidades" className="hover:text-text-primary transition-colors">
                  Especialidades
                </Link>
              </li>
              <li>
                <Link href="/profissionais" className="hover:text-text-primary transition-colors">
                  Profissionais
                </Link>
              </li>
            </ul>
          </div>

          {/* Information */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--link)] font-heading mb-4">Serviços & Convênios</p>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/convenios" className="hover:text-text-primary transition-colors">
                  Convênios Atendidos
                </Link>
              </li>
              <li>
                <Link href="/estrutura" className="hover:text-text-primary transition-colors">
                  Estrutura & Tecnologia
                </Link>
              </li>
              <li>
                <Link href="/contato" className="hover:text-text-primary transition-colors">
                  Contato & Localização
                </Link>
              </li>
              <li>
                <Link href="/cliente/login" className="hover:text-text-primary transition-colors">
                  Área do Paciente
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--link)] font-heading mb-4">Atendimento</p>
            {address && <p className="text-xs text-text-secondary leading-relaxed mb-3">{address}</p>}
            {email && <p className="text-xs text-text-secondary leading-relaxed mb-3">{email}</p>}
            {extraPhones.length > 0 && (
              <p className="text-xs text-text-secondary leading-relaxed mb-3">{extraPhones.join(" · ")}</p>
            )}
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--link)] hover:text-text-primary transition-colors"
              >
                <span>Central de Atendimento{whatsappDisplay ? ` — ${whatsappDisplay}` : ""}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            )}
          </div>
        </div>

        <div className="mt-14 border-t border-border/70 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted">
          <p>© {new Date().getFullYear()} {clinicName}. Todos os direitos reservados.</p>
          <p>Plataforma desenvolvida para alta performance e segurança.</p>
        </div>

        {/* Developer Signature Section */}
        <div className="mt-6 border-t border-border/40 pt-4">
          <DeveloperSignature />
        </div>
      </div>
    </footer>
  );
}
