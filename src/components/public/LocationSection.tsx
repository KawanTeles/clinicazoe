import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ScrollReveal } from "@/components/public/ScrollReveal";
import { formatWhatsAppDisplay } from "@/lib/whatsapp";
import { buildMapsEmbedUrl, buildMapsViewUrl } from "@/lib/maps";
import { WEEKDAY_LABELS } from "@/modules/settings/utils/form-state";
import type { BusinessHourEntry } from "@/lib/supabase/types";

interface LocationSectionProps {
  clinicName: string;
  address?: string | null;
  whatsappNumber?: string | null;
  email?: string | null;
  businessHours?: BusinessHourEntry[];
  holidayOpen?: boolean;
  holidayOpenTime?: string | null;
  holidayCloseTime?: string | null;
  mapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export function LocationSection({
  clinicName,
  address,
  whatsappNumber,
  email,
  businessHours,
  holidayOpen,
  holidayOpenTime,
  holidayCloseTime,
  mapsUrl,
  latitude,
  longitude,
}: LocationSectionProps) {
  const viewUrl = buildMapsViewUrl({ mapsUrl, latitude, longitude, address });
  const embedUrl = buildMapsEmbedUrl({ mapsUrl, latitude, longitude, address });
  const whatsappDisplay = formatWhatsAppDisplay(whatsappNumber);
  const sortedHours = businessHours ? [...businessHours].sort((a, b) => a.day - b.day) : [];

  return (
    <section id="como-chegar" className="py-20 border-t border-border/70 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <ScrollReveal animation="fade-up">
            <Badge tone="premium" className="border border-[rgba(110,231,183,0.3)] shadow-[0_0_15px_rgba(46,139,87,0.2)]">Facilidade de Acesso</Badge>
            <h2 className="text-3xl sm:text-4xl font-black text-text-primary mt-2 tracking-tight font-heading">
              Como Chegar à {clinicName}
            </h2>
            <p className="text-sm sm:text-base text-text-secondary font-normal">
              Localização privilegiada no coração da cidade com facilidade de acesso, valete e transporte público.
            </p>
          </ScrollReveal>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Details Card */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-3xl border border-[rgba(110,231,183,0.18)] bg-card p-8 shadow-card space-y-6 hover:border-[rgba(110,231,183,0.35)] transition-all duration-300">
            <div className="space-y-6">
              {address && (
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--link)]">Endereço Completo</span>
                  <p className="text-base font-bold text-text-primary mt-1 leading-relaxed">{address}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/70 text-xs">
                <div>
                  <span className="text-text-muted font-semibold">Telefone / WhatsApp:</span>
                  <p className="text-sm font-bold text-[var(--link)] mt-0.5">
                    {whatsappDisplay ?? "Não disponível"}
                  </p>
                </div>
                {email && (
                  <div>
                    <span className="text-text-muted font-semibold">E-mail:</span>
                    <p className="text-sm font-bold text-text-primary mt-0.5">{email}</p>
                  </div>
                )}
              </div>

              {sortedHours.length > 0 && (
                <div className="pt-4 border-t border-border/70 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--link)]">Horário de Funcionamento</span>
                  <div className="text-xs text-text-secondary space-y-1">
                    {sortedHours.map((entry) => (
                      <p key={entry.day}>
                        <strong className="text-text-primary">{WEEKDAY_LABELS[entry.day]}:</strong>{" "}
                        {entry.is_open ? `${entry.open_time} às ${entry.close_time}` : "Fechado"}
                      </p>
                    ))}
                    <p>
                      <strong className="text-text-primary">Feriados:</strong>{" "}
                      {holidayOpen ? `${holidayOpenTime} às ${holidayCloseTime}` : "Fechado"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {viewUrl && (
              <div className="pt-4">
                <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="block w-full">
                  <Button variant="secondary" size="lg" withArrow className="w-full font-bold shadow-xs hover:scale-[1.02]">
                    Ver rota no Google Maps
                  </Button>
                </a>
              </div>
            )}
          </div>

          {/* Right Map Embed */}
          <div className="lg:col-span-7 rounded-3xl border border-[rgba(110,231,183,0.18)] overflow-hidden min-h-[350px] lg:min-h-[450px] relative shadow-lg">
            {embedUrl && (
              <iframe
                title={`Mapa de localização da ${clinicName}`}
                src={embedUrl}
                width="100%"
                height="100%"
                style={{ border: 0, minHeight: "350px", filter: "invert(90%) hue-rotate(180deg) brightness(95%) contrast(90%)" }}
                allowFullScreen={false}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
