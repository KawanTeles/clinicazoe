"use client";

import Image from "next/image";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { buildFullAddress } from "@/modules/settings/utils/address";
import { formatWhatsAppDisplay } from "@/lib/whatsapp";
import { WEEKDAY_LABELS, type ClinicSettingsFormState } from "@/modules/settings/utils/form-state";

const SOCIAL_LINKS: Array<{ key: keyof ClinicSettingsFormState; label: string }> = [
  { key: "instagram_url", label: "Instagram" },
  { key: "facebook_url", label: "Facebook" },
  { key: "linkedin_url", label: "LinkedIn" },
  { key: "youtube_url", label: "YouTube" },
];

export function SitePreview({ data, logoUrl }: { data: ClinicSettingsFormState; logoUrl: string | null }) {
  const address = buildFullAddress(data);
  const whatsappDisplay = formatWhatsAppDisplay(data.whatsapp_number);
  const activeSocials = SOCIAL_LINKS.filter((social) => data[social.key]);

  return (
    <Card className="w-full max-w-full overflow-hidden flex flex-col border border-border shadow-card rounded-2xl">
      <CardHeader className="py-3.5 px-5 shrink-0 bg-card-elevated/60 border-b border-border/60">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-[var(--primary)] flex items-center gap-1.5">
            <span>👁️</span> Prévia no Site
          </CardTitle>
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0">
            Ao vivo
          </span>
        </div>
        <p className="text-[10px] font-medium text-text-muted mt-0.5">
          Atualiza em tempo real enquanto você digita
        </p>
      </CardHeader>

      <CardContent className="p-4 flex flex-col gap-3.5 overflow-y-auto max-h-[calc(100vh-10rem)] xl:max-h-[calc(100vh-8rem)] custom-scrollbar">
        {/* Mini header */}
        <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card-elevated/50 p-3 shadow-xs">
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border bg-card shadow-xs flex items-center justify-center">
            {logoUrl ? (
              <Image src={logoUrl} alt={data.name || "Logo"} fill className="object-contain p-0.5" unoptimized />
            ) : (
              <span className="text-[9px] font-bold text-text-muted uppercase">Logo</span>
            )}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-extrabold text-text-primary font-heading leading-snug break-words">
              {data.name || "Nome da Clínica"}
            </span>
            {data.legal_name && (
              <span className="text-[10px] font-medium text-text-muted break-words">
                {data.legal_name}
              </span>
            )}
          </div>
        </div>

        {/* Mini contact card */}
        <div className="flex flex-col gap-2.5 rounded-xl border border-border/70 bg-card-elevated/50 p-3 text-xs shadow-xs">
          <div className="space-y-0.5">
            <span className="font-bold uppercase tracking-wider text-[10px] text-[var(--link)] block">
              📍 Endereço
            </span>
            <p className="text-text-secondary text-[11px] leading-relaxed break-words">
              {address ?? "Não informado"}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 pt-2 border-t border-border/40 sm:grid-cols-2">
            <div className="space-y-0.5 min-w-0">
              <span className="font-bold uppercase tracking-wider text-[10px] text-[var(--link)] block">
                💬 WhatsApp
              </span>
              <p className="text-text-secondary text-[11px] font-medium break-words">
                {whatsappDisplay ?? "Não informado"}
              </p>
            </div>
            {data.email && (
              <div className="space-y-0.5 min-w-0">
                <span className="font-bold uppercase tracking-wider text-[10px] text-[var(--link)] block">
                  ✉️ E-mail
                </span>
                <p className="text-text-secondary text-[11px] break-all">
                  {data.email}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Mini business hours */}
        <div className="rounded-xl border border-border/70 bg-card-elevated/50 p-3 shadow-xs">
          <span className="font-bold uppercase tracking-wider text-[10px] text-[var(--link)] block mb-2">
            🕒 Horário de Funcionamento
          </span>
          <div className="flex flex-col divide-y divide-border/30 text-[11px]">
            {[...data.business_hours]
              .sort((a, b) => a.day - b.day)
              .map((entry) => (
                <div key={entry.day} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="font-medium text-text-primary shrink-0">
                    {WEEKDAY_LABELS[entry.day]}
                  </span>
                  <span className={entry.is_open ? "text-text-secondary font-medium text-right" : "text-text-muted font-medium text-right"}>
                    {entry.is_open ? `${entry.open_time} às ${entry.close_time}` : "Fechado"}
                  </span>
                </div>
              ))}
            <div className="flex items-center justify-between gap-2 py-1.5 pt-2">
              <span className="font-bold text-text-primary shrink-0">Feriados</span>
              <span className={data.holiday_open ? "text-text-secondary font-medium text-right" : "text-text-muted font-medium text-right"}>
                {data.holiday_open ? `${data.holiday_open_time} às ${data.holiday_close_time}` : "Fechado"}
              </span>
            </div>
          </div>
        </div>

        {/* Mini social icons */}
        <div className="rounded-xl border border-border/70 bg-card-elevated/50 p-3 shadow-xs">
          <span className="font-bold uppercase tracking-wider text-[10px] text-[var(--link)] block mb-2">
            🌐 Redes Sociais
          </span>
          <div className="flex flex-wrap gap-1.5">
            {activeSocials.length === 0 ? (
              <span className="text-[11px] text-text-muted">Nenhuma rede social cadastrada</span>
            ) : (
              activeSocials.map((social) => (
                <Badge key={social.key} tone="premium" className="text-[10px] py-0.5 px-2">
                  {social.label}
                </Badge>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

