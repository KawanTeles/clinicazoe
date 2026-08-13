import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getPatientsForProfessional } from "@/modules/appointments/services/patient-queries";

export const metadata = {
  title: "Meus Pacientes — Espaço Zoe",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export default async function MyPatientsPage() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") redirect("/dashboard");

  const patients = await getPatientsForProfessional(session.user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">Meus Pacientes</h1>
        <p className="mt-1 text-sm text-text-secondary">Pacientes que já consultaram com você.</p>
      </div>

      {patients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm font-medium text-text-secondary">
          Nenhum paciente ainda.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-border bg-card-elevated/80 text-xs font-bold uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-5 py-4 font-bold">Nome</th>
                <th className="px-5 py-4 font-bold">Telefone</th>
                <th className="px-5 py-4 font-bold">Último atendimento</th>
                <th className="px-5 py-4 font-bold">Total de atendimentos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {patients.map((patient) => (
                <tr key={patient.patientId} className="transition-colors hover:bg-surface/50">
                  <td className="px-5 py-4 font-semibold text-text-primary">
                    <Link href={`/my-patients/${patient.patientId}`} className="hover:text-primary hover:underline">
                      {patient.fullName}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-text-secondary">{patient.phone || "—"}</td>
                  <td className="px-5 py-4 text-text-secondary">
                    {dateFormatter.format(new Date(`${patient.lastAppointmentDate}T00:00:00`))}
                  </td>
                  <td className="px-5 py-4 font-semibold text-[var(--link)]">{patient.appointmentCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

