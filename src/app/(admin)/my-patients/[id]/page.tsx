import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPatientDetail } from "@/modules/patients/services/patient-queries";
import { getEvolutionsForPatient } from "@/modules/evolutions/services/evolution-queries";
import { EvolutionTimeline } from "@/modules/evolutions/components/EvolutionTimeline";
import { Badge } from "@/components/ui/Badge";

export const metadata = {
  title: "Paciente — ClinicaZoe",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export default async function MyPatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") redirect("/dashboard");

  const { id } = await params;

  // getPatientDetail depende da RLS de profiles/patient_details, que só
  // libera dados de pacientes com quem este profissional já teve consulta —
  // se não pertencer a ele, volta null e cai no notFound() abaixo.
  const [patient, evolutions] = await Promise.all([getPatientDetail(id), getEvolutionsForPatient(id)]);

  if (!patient) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">{patient.fullName}</h1>
        <div className="mt-1 flex items-center gap-2">
          <Badge tone={patient.status === "active" ? "success" : "neutral"}>
            {patient.status === "active" ? "Ativo" : "Inativo"}
          </Badge>
          <span className="text-sm text-text-secondary">{patient.phone || "Sem telefone"}</span>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-text-secondary">Dados</h2>
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-6 shadow-card sm:grid-cols-2">
          <Field label="Telefone" value={patient.phone} />
          <Field label="E-mail" value={patient.details?.email} />
          <Field label="WhatsApp" value={patient.details?.whatsapp} />
          <Field label="Cidade" value={patient.details?.city} />
          <Field
            label="Data de nascimento"
            value={
              patient.details?.birth_date
                ? dateFormatter.format(new Date(`${patient.details.birth_date}T00:00:00`))
                : null
            }
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-text-secondary">Histórico Clínico</h2>
        <EvolutionTimeline evolutions={evolutions} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">{label}</p>
      <p className="mt-1 text-sm text-text-primary">{value || "—"}</p>
    </div>
  );
}
