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
        <h1 className="text-2xl font-bold tracking-tight text-[#F5F7F6]">Meus Pacientes</h1>
        <p className="mt-1 text-sm text-[#C8D4CF]">Pacientes que já consultaram com você.</p>
      </div>

      {patients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#255044] bg-[#102A22] p-12 text-center text-sm font-medium text-[#C8D4CF]">
          Nenhum paciente ainda.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#255044] bg-[#102A22] shadow-[0_10px_40px_rgba(0,0,0,0.25)]">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-[#255044] bg-[#17382D]/80 text-xs font-bold uppercase tracking-wider text-[#C8D4CF]">
              <tr>
                <th className="px-5 py-4 font-bold">Nome</th>
                <th className="px-5 py-4 font-bold">Telefone</th>
                <th className="px-5 py-4 font-bold">Última consulta</th>
                <th className="px-5 py-4 font-bold">Total de consultas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#255044]/40">
              {patients.map((patient) => (
                <tr key={patient.patientId} className="transition-colors hover:bg-[#17382D]/50">
                  <td className="px-5 py-4 font-semibold text-[#F5F7F6]">{patient.fullName}</td>
                  <td className="px-5 py-4 text-[#C8D4CF]">{patient.phone || "—"}</td>
                  <td className="px-5 py-4 text-[#C8D4CF]">
                    {dateFormatter.format(new Date(`${patient.lastAppointmentDate}T00:00:00`))}
                  </td>
                  <td className="px-5 py-4 font-semibold text-[#5ED39D]">{patient.appointmentCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

