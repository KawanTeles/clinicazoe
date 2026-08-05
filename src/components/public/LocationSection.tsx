import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ScrollReveal } from "@/components/public/ScrollReveal";

interface LocationSectionProps {
  clinicName: string;
  address?: string | null;
  whatsappNumber?: string | null;
}

export function LocationSection({ clinicName, address, whatsappNumber }: LocationSectionProps) {
  const fullAddress = address || "Av. Paulista, 1000 - Bela Vista, São Paulo - SP, CEP 01310-100";
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`;

  return (
    <section id="como-chegar" className="py-20 border-t border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <ScrollReveal animation="fade-up">
            <Badge tone="premium">Facilidade de Acesso</Badge>
            <h2 className="text-3xl sm:text-4xl font-black text-text-primary mt-2 tracking-tight font-heading">
              Como Chegar à Clínica Zoe
            </h2>
            <p className="text-sm sm:text-base text-text-secondary">
              Localização privilegiada no coração da cidade com facilidade de acesso, valete e transporte público.
            </p>
          </ScrollReveal>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Details Card */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-3xl border border-border bg-card p-8 shadow-card space-y-6">
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Endereço Completo</span>
                <p className="text-base font-bold text-text-primary mt-1 leading-relaxed">{fullAddress}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/60 text-xs">
                <div>
                  <span className="text-text-muted font-semibold">Telefone:</span>
                  <p className="text-sm font-bold text-text-primary mt-0.5">(11) 3200-0000</p>
                </div>
                <div>
                  <span className="text-text-muted font-semibold">WhatsApp:</span>
                  <p className="text-sm font-bold text-primary mt-0.5">
                    {whatsappNumber ? `+${whatsappNumber}` : "(11) 99999-9999"}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-text-muted font-semibold">E-mail:</span>
                  <p className="text-sm font-bold text-text-primary mt-0.5">contato@clinicazoe.com.br</p>
                </div>
              </div>

              <div className="pt-4 border-t border-border/60 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Horário de Funcionamento</span>
                <div className="text-xs text-text-secondary space-y-1">
                  <p><strong className="text-text-primary">Segunda a Sexta-feira:</strong> 07:00 às 20:00</p>
                  <p><strong className="text-text-primary">Sábados:</strong> 08:00 às 14:00</p>
                  <p><strong className="text-text-primary">Domingos e Feriados:</strong> Fechado</p>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="block w-full">
                <Button size="lg" withArrow className="w-full font-bold shadow-button">
                  Ver rota no Google Maps
                </Button>
              </a>
            </div>
          </div>

          {/* Right Map Embed */}
          <div className="lg:col-span-7 rounded-3xl border border-border overflow-hidden min-h-[350px] lg:min-h-[450px] relative shadow-lg">
            <iframe
              title={`Mapa de localização da ${clinicName}`}
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3657.1975765796245!2d-46.65438868440539!3d-23.561349584682496!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ce59c8da0aa315%3A0xd59f9431f2c9776a!2sAv.%20Paulista%2C%201000%20-%20Bela%20Vista%2C%20S%C3%A3o%20Paulo%20-%20SP%2C%2001310-100!5e0!3m2!1spt-BR!2sbr!4v1629837482910!5m2!1spt-BR!2sbr"
              width="100%"
              height="100%"
              style={{ border: 0, minHeight: "350px", filter: "invert(90%) hue-rotate(180deg) brightness(95%) contrast(90%)" }}
              allowFullScreen={false}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
