import Link from "next/link";
import { DeveloperSignature } from "@/components/public/DeveloperSignature";

interface PublicFooterProps {
  clinicName: string;
  address?: string | null;
  whatsappNumber?: string | null;
}

export function PublicFooter({ clinicName, address, whatsappNumber }: PublicFooterProps) {
  return (
    <footer className="border-t border-border/80 bg-[var(--bg-footer)] pt-14 pb-6 text-text-secondary">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand Info */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-forest text-sm font-black text-white shadow-md">
                CZ
              </div>
              <span className="text-xl font-bold text-text-primary font-heading">{clinicName}</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Excelência em saúde integrada com inovação tecnológica, infraestrutura de alto padrão e cuidado humanizado.
            </p>
          </div>

          {/* Navigation Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--link)] font-heading mb-4">Navegação</h4>
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
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--link)] font-heading mb-4">Serviços & Convênios</h4>
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
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--link)] font-heading mb-4">Atendimento</h4>
            <p className="text-xs text-text-secondary leading-relaxed mb-3">
              {address || "Av. Paulista, 1000 - Bela Vista, São Paulo - SP"}
            </p>
            {whatsappNumber && (
              <a
                href={`https://wa.me/${whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--link)] hover:text-text-primary transition-colors"
              >
                <span>Central de Atendimento</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            )}
          </div>
        </div>

        <div className="mt-12 border-t border-border/70 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-text-muted gap-3">
          <p>© {new Date().getFullYear()} {clinicName}. Todos os direitos reservados.</p>
          <p className="mt-1 sm:mt-0">Plataforma desenvolvida para alta performance e segurança.</p>
        </div>

        {/* Developer Signature Section */}
        <div className="mt-4 border-t border-border/40 pt-2">
          <DeveloperSignature />
        </div>
      </div>
    </footer>
  );
}

