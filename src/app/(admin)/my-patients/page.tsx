import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPatientsForProfessional } from "@/modules/appointments/services/patient-queries";

export const metadata = {
  title: "Meus Pacientes — ClinicaZoe",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export default async function MyPatientsPage() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") redirect("/dashboard");

  const patients = await getPatientsForProfessional(session.user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Meus Pacientes</h1>
        <p className="text-sm text-text-secondary">Pacientes que já consultaram com você.</p>
      </div>

      {patients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-text-secondary">
          Nenhum paciente ainda.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Telefone</th>
                <th className="px-4 py-3 font-medium">Última consulta</th>
                <th className="px-4 py-3 font-medium">Total de consultas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {patients.map((patient) => (
                <tr key={patient.patientId}>
                  <td className="px-4 py-3 text-text-primary">{patient.fullName}</td>
                  <td className="px-4 py-3 text-text-secondary">{patient.phone || "—"}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {dateFormatter.format(new Date(`${patient.lastAppointmentDate}T00:00:00`))}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{patient.appointmentCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
