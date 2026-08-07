import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { searchEvolutions } from "@/modules/evolutions/services/evolution-queries";
import { EvolutionSearchResults } from "@/modules/evolutions/components/EvolutionSearchResults";
import { getActiveProfessionals } from "@/modules/professionals/services/professional-queries";
import { getActiveSpecialties } from "@/modules/specialties/services/specialty-queries";

export const metadata = {
  title: "Evoluções — ClinicaZoe",
};

interface SearchParams {
  patientQuery?: string;
  professionalId?: string;
  specialtyId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: string;
}

export default async function EvolutionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Evolução do Paciente é prontuário clínico: acesso exclusivo do
  // profissional responsável (sigilo profissional / LGPD). A RLS de
  // patient_evolutions já restringe searchEvolutions() às evoluções do
  // próprio profissional mesmo que ele filtre por outro nome.
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") redirect("/dashboard");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const [{ items, totalPages }, professionals, specialties] = await Promise.all([
    searchEvolutions({
      patientQuery: params.patientQuery,
      professionalId: params.professionalId,
      specialtyId: params.specialtyId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      page,
    }),
    getActiveProfessionals(),
    getActiveSpecialties(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">Evolução do Paciente</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Busque o histórico clínico dos seus pacientes por nome, especialidade ou período.
        </p>
      </div>

      <form
        method="get"
        className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 shadow-card sm:grid-cols-2 lg:grid-cols-5"
      >
        <Input name="patientQuery" placeholder="Nome do paciente" defaultValue={params.patientQuery} className="h-10 text-xs" />
        <Select name="professionalId" defaultValue={params.professionalId ?? ""}>
          <option value="">Todos os profissionais</option>
          {professionals.map((professional) => (
            <option key={professional.id} value={professional.id}>
              {professional.full_name}
            </option>
          ))}
        </Select>
        <Select name="specialtyId" defaultValue={params.specialtyId ?? ""}>
          <option value="">Todas as especialidades</option>
          {specialties.map((specialty) => (
            <option key={specialty.id} value={specialty.id}>
              {specialty.name}
            </option>
          ))}
        </Select>
        <Input type="date" name="dateFrom" defaultValue={params.dateFrom} className="h-10 text-xs" />
        <div className="flex gap-2">
          <Input type="date" name="dateTo" defaultValue={params.dateTo} className="h-10 text-xs" />
          <Button type="submit" size="sm" className="shrink-0">
            Buscar
          </Button>
        </div>
      </form>

      <EvolutionSearchResults items={items} />
      <Pagination
        page={page}
        totalPages={totalPages}
        basePath="/evolutions"
        searchParams={{
          patientQuery: params.patientQuery,
          professionalId: params.professionalId,
          specialtyId: params.specialtyId,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
        }}
      />
    </div>
  );
}
