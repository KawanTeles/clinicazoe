import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPublicWebsiteData } from "@/lib/public-queries";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { Patient8StepBooking } from "@/components/patient/Patient8StepBooking";
import { Badge } from "@/components/ui/Badge";

export const metadata = {
  title: "Agendamento de Consulta em 8 Etapas — Clínica Zoe",
  description: "Fluxo completo de agendamento online para pacientes.",
};

export default async function PatientAgendarPage() {
  const session = await getCurrentUser();

  if (!session) {
    redirect("/cliente/login");
  }

  const { clinic, specialties, professionals } = await getPublicWebsiteData();

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col font-sans selection:bg-primary selection:text-white">
      <PublicHeader clinicName={clinic.name} />

      <main className="flex-1 py-12 lg:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <Badge tone="premium">Novo Agendamento</Badge>
            <h1 className="text-3xl font-extrabold text-text-primary font-heading">Solicitar Consulta Médica</h1>
            <p className="text-xs sm:text-sm text-text-secondary">
              Siga as 8 etapas para escolher a cidade, convênio, médico, data e horário ideal.
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
      </main>

      <PublicFooter clinicName={clinic.name} address={clinic.address} whatsappNumber={clinic.whatsapp_number} />
    </div>
  );
}
