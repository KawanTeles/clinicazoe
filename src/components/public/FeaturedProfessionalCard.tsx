import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CTA_VIEW_PROFILE } from "@/lib/cta-labels";
import { buildEntitySlug } from "@/lib/slug";

export interface FeaturedProfessionalData {
  id: string;
  fullName: string;
  specialtyName: string;
  licenseNumber: string | null;
  bio: string;
  avatarUrl: string | null;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (first + last).toUpperCase();
}

/**
 * Card de profissional em destaque na home — foto grande no topo com a
 * especialidade sobreposta no canto (destaque vai para especialidade e
 * formação/bio, não para o registro profissional, que fica discreto no
 * rodapé do card quando exibido). Estilo próprio dessa seção (não é o mesmo
 * card usado em /profissionais, que continua com a foto centralizada).
 */
export function FeaturedProfessionalCard({ professional: prof }: { professional: FeaturedProfessionalData }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-border/80 bg-card shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)]">
      <div className="relative aspect-[4/3] w-full bg-card-elevated">
        {prof.avatarUrl ? (
          <Image
            src={prof.avatarUrl}
            alt={prof.fullName}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-card-elevated to-primary/10">
            <span className="text-4xl font-black text-primary/30">{initials(prof.fullName)}</span>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <Badge tone="premium" className="text-[10px] uppercase tracking-wider shadow-sm backdrop-blur-sm">
            {prof.specialtyName}
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-lg font-bold text-text-primary font-heading">{prof.fullName}</h3>

        <p className="mt-3 flex-1 text-sm leading-relaxed text-text-secondary line-clamp-3">{prof.bio}</p>

        {prof.licenseNumber && (
          <p className="mt-3 text-[10px] font-mono text-text-muted">{prof.licenseNumber}</p>
        )}

        <Link href={`/profissionais/${buildEntitySlug(prof.fullName, prof.id)}`} className="mt-5 block w-full">
          <Button variant="secondary" className="w-full font-bold">
            {CTA_VIEW_PROFILE}
          </Button>
        </Link>
      </div>
    </div>
  );
}
