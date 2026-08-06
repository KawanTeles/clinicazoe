"use client";

import { useState } from "react";
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
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [activeTab, setActiveTab] = useState<"general" | "hours">("general");

  const address = buildFullAddress(data);
  const whatsappDisplay = formatWhatsAppDisplay(data.whatsapp_number);
  const activeSocials = SOCIAL_LINKS.filter((social) => data[social.key]);
  const cleanWebsiteUrl = data.website_url ? data.website_url.replace(/^https?:\/\//, "") : "clinicazoe.com.br";

  // Check if clinic is open today
  const todayIndex = new Date().getDay(); // 0 is Sunday
  const todayHours = data.business_hours.find((h) => h.day === todayIndex);

  return (
    <Card className="w-full max-w-full overflow-hidden flex flex-col border border-border shadow-card-hover rounded-2xl transition-all duration-300">
      {/* Top Header Controls */}
      <CardHeader className="py-3 px-4 shrink-0 bg-card-elevated/70 border-b border-border/60">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-[var(--primary)] flex items-center gap-1.5">
            <span>👁️</span> Prévia Interativa
          </CardTitle>
          <div className="flex items-center gap-1 bg-card border border-border/80 rounded-lg p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode("desktop")}
              className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${
                viewMode === "desktop"
                  ? "bg-primary text-white shadow-xs"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              🖥️ Desktop
            </button>
            <button
              type="button"
              onClick={() => setViewMode("mobile")}
              className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${
                viewMode === "mobile"
                  ? "bg-primary text-white shadow-xs"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              📱 Mobile
            </button>
          </div>
        </div>
      </CardHeader>

      {/* Browser Window Mockup Container */}
      <div className={`p-3 bg-card-elevated/20 transition-all duration-300 ${viewMode === "mobile" ? "max-w-[320px] mx-auto" : "w-full"}`}>
        <div className="rounded-xl border border-border/80 bg-card shadow-lg overflow-hidden flex flex-col">
          {/* Mockup Top Browser Bar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-card-elevated border-b border-border/60">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80 inline-block" />
            </div>
            <div className="flex-1 mx-3 flex items-center justify-center bg-card border border-border/60 rounded-md px-2 py-0.5 text-[9.5px] font-medium text-text-muted truncate">
              <span className="mr-1 opacity-60">🔒</span> {cleanWebsiteUrl}
            </div>
            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              Ao vivo
            </span>
          </div>

          {/* Mini Nav Tab Bar inside Mockup */}
          <div className="flex items-center justify-between px-3 py-2 bg-card/95 border-b border-border/40 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full border border-border bg-card-elevated flex items-center justify-center">
                {logoUrl ? (
                  <Image src={logoUrl} alt={data.name || "Logo"} fill className="object-contain p-0.5" unoptimized />
                ) : (
                  <span className="text-[7px] font-bold text-text-muted">LOGO</span>
                )}
              </div>
              <span className="text-xs font-bold text-text-primary truncate font-heading">
                {data.name || "Sua Clínica"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab("general")}
                className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-colors ${
                  activeTab === "general" ? "bg-primary/10 text-primary" : "text-text-muted hover:text-text-primary"
                }`}
              >
                Geral
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("hours")}
                className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-colors ${
                  activeTab === "hours" ? "bg-primary/10 text-primary" : "text-text-muted hover:text-text-primary"
                }`}
              >
                Horários
              </button>
            </div>
          </div>

          {/* Mini Live Site Content Body */}
          <CardContent className="p-3.5 flex flex-col gap-3 max-h-[460px] overflow-y-auto custom-scrollbar bg-background/50">
            {activeTab === "general" ? (
              <>
                {/* Hero Banner Box */}
                <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-3 shadow-xs flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-extrabold text-text-primary leading-tight font-heading break-words">
                        {data.name || "Nome da Clínica"}
                      </h4>
                      {data.legal_name && (
                        <p className="text-[9.5px] text-text-muted mt-0.5 break-words">
                          {data.legal_name}
                        </p>
                      )}
                    </div>
                    {todayHours && (
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        todayHours.is_open
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                      }`}>
                        {todayHours.is_open ? "Aberto Hoje" : "Fechado Hoje"}
                      </span>
                    )}
                  </div>

                  {/* Primary WhatsApp CTA Button Preview */}
                  {data.whatsapp_number && (
                    <div className="mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-3 text-[11px] font-bold shadow-xs">
                      <span>💬</span> Falar no WhatsApp ({whatsappDisplay})
                    </div>
                  )}
                </div>

                {/* Address & Contact Block */}
                <div className="rounded-xl border border-border/70 bg-card p-3 flex flex-col gap-2 shadow-xs">
                  <div className="space-y-0.5">
                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--link)]">
                      📍 Localização
                    </span>
                    <p className="text-[11px] text-text-secondary leading-relaxed break-words">
                      {address ?? "Endereço não informado"}
                    </p>
                  </div>

                  {data.email && (
                    <div className="pt-1.5 border-t border-border/40 space-y-0.5">
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--link)]">
                        ✉️ E-mail de Contato
                      </span>
                      <p className="text-[11px] text-text-secondary break-all">
                        {data.email}
                      </p>
                    </div>
                  )}
                </div>

                {/* Social links */}
                <div className="rounded-xl border border-border/70 bg-card p-3 shadow-xs space-y-1.5">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--link)] block">
                    🌐 Redes Sociais
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeSocials.length === 0 ? (
                      <span className="text-[10px] text-text-muted">Nenhuma rede social vinculada</span>
                    ) : (
                      activeSocials.map((social) => (
                        <Badge key={social.key} tone="premium" className="text-[9.5px] py-0.5 px-2">
                          {social.label}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* Business Hours Tab Content */
              <div className="rounded-xl border border-border/70 bg-card p-3 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--link)]">
                    🕒 Horário Semanal
                  </span>
                  <span className="text-[10px] text-text-muted font-medium">Horário local</span>
                </div>

                <div className="flex flex-col divide-y divide-border/30 text-[11px]">
                  {[...data.business_hours]
                    .sort((a, b) => a.day - b.day)
                    .map((entry) => (
                      <div key={entry.day} className="flex items-center justify-between gap-2 py-1.5">
                        <span className="font-medium text-text-primary shrink-0">
                          {WEEKDAY_LABELS[entry.day]}
                        </span>
                        <span className={entry.is_open ? "text-text-secondary font-medium text-right" : "text-text-muted text-right font-semibold"}>
                          {entry.is_open ? `${entry.open_time} às ${entry.close_time}` : "Fechado"}
                        </span>
                      </div>
                    ))}
                  <div className="flex items-center justify-between gap-2 py-1.5 pt-2">
                    <span className="font-bold text-text-primary shrink-0">Feriados</span>
                    <span className={data.holiday_open ? "text-text-secondary font-medium text-right" : "text-text-muted text-right font-semibold"}>
                      {data.holiday_open ? `${data.holiday_open_time} às ${data.holiday_close_time}` : "Fechado"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </div>
      </div>
    </Card>
  );
}


