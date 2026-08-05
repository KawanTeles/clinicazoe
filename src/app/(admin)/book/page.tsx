import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getBookableSpecialties } from "@/modules/appointments/services/booking-queries";
import { BookingWizard } from "@/modules/appointments/components/BookingWizard";

export const metadata = {
  title: "Agendar consulta — ClinicaZoe",
};

export default async function BookPage() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "paciente") redirect("/dashboard");

  const specialties = await getBookableSpecialties();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">Agendar consulta</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Escolha a especialidade, o convênio, o profissional e o horário.
        </p>
      </div>

      {specialties.length === 0 ? (
        <p className="text-sm font-medium text-text-secondary">
          Nenhuma especialidade disponível para agendamento no momento.
        </p>
      ) : (
        <BookingWizard specialties={specialties} />
      )}
    </div>
  );
}

