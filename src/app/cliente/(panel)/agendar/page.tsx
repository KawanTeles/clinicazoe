import { getCurrentUser } from "@/lib/auth";
import { getPublicWebsiteData } from "@/lib/public-queries";
import { Patient8StepBooking } from "@/components/patient/Patient8StepBooking";
import { Badge } from "@/components/ui/Badge";

export const metadata = {
  title: "Agendamento de Atendimento em 8 Etapas — Espaço Zoe",
  description: "Fluxo completo de agendamento online para pacientes.",
};

export default async function PatientAgendarPage() {
  const session = await getCurrentUser();
  if (!session) return null;

  const { clinic, specialties, professionals } = await getPublicWebsiteData();

  return (
    <div className="space-y-8">
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <Badge tone="premium">Novo Agendamento</Badge>
        <h1 className="text-3xl font-extrabold text-text-primary font-heading">Solicitar Atendimento</h1>
        <p className="text-xs sm:text-sm text-text-secondary">
          Siga as 8 etapas para escolher a cidade, convênio, profissional, data e horário ideal.
        </p>
      </div>

      <Patient8StepBooking
        specialties={specialties}
        initialProfessionals={professionals}
        patientProfile={{
          fullName: session.profile.full_name,
          phone: session.profile.phone,
          email: session.user.email,
        }}
        whatsappNumber={clinic.whatsapp_number}
      />
    </div>
  );
}
