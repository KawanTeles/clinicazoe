import Link from "next/link";
import { AnimatedCard } from "@/components/animation/AnimatedCard";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CTA_PRIMARY, CTA_VIEW_PROFILE } from "@/lib/cta-labels";
import { buildEntitySlug } from "@/lib/slug";

export interface ProfessionalCardData {
  id: string;
  fullName: string;
  specialtyName: string;
  licenseNumber: string;
  bio: string;
  avatarUrl: string | null;
}

interface ProfessionalCardProps {
  professional: ProfessionalCardData;
  delayMs?: number;
  /** Tamanho da foto em px — a página de listagem usa uma foto maior que a do carrossel da home. */
  avatarSize?: number;
  /** Exibe também o CTA secundário de agendamento (só faz sentido na listagem, não no carrossel da home). */
  showBookCta?: boolean;
  className?: string;
}

/**
 * Card de profissional — foto centralizada em destaque, sem duração de
 * consulta nem valores (removidos: são dados operacionais, não relevantes
 * para a decisão do paciente aqui). O espaço livre vira a biografia, com
 * reticências (line-clamp) quando o texto é longo — "Ver Perfil" já cobre o
 * "ler mais".
 */
export function ProfessionalCard({ professional: prof, delayMs = 0, avatarSize = 96, showBookCta = false, className }: ProfessionalCardProps) {
  return (
    <AnimatedCard delayMs={delayMs} className={className ?? "p-6 sm:p-8 flex flex-col items-center text-center h-full rounded-3xl"}>
      <Avatar
        src={prof.avatarUrl}
        name={prof.fullName}
        size={avatarSize}
        rounded="full"
        className="shadow-[0_8px_24px_rgba(54,99,84,0.18)] ring-4 ring-primary/10"
      />

      <h3 className="mt-4 text-lg font-bold text-text-primary font-heading">{prof.fullName}</h3>
      <Badge tone="success" className="mt-2 text-xs border border-[rgba(135,201,179,0.3)]">
        {prof.specialtyName}
      </Badge>
      <p className="mt-2 text-xs text-text-muted font-mono">{prof.licenseNumber}</p>

      <p className="mt-4 text-sm text-text-secondary leading-relaxed line-clamp-4 flex-1">{prof.bio}</p>

      <div className="mt-6 pt-4 border-t border-border/60 w-full space-y-2.5">
        <Link href={`/profissionais/${buildEntitySlug(prof.fullName, prof.id)}`} className="block w-full">
          <Button variant="secondary" size="sm" className="w-full font-bold border border-border/80 hover:border-primary/60">
            {CTA_VIEW_PROFILE}
          </Button>
        </Link>
        {showBookCta && (
          <Link href="/agendar" className="block w-full">
            <Button variant="outline" size="sm" className="w-full font-bold" withArrow>
              {CTA_PRIMARY}
            </Button>
          </Link>
        )}
      </div>
    </AnimatedCard>
  );
}
