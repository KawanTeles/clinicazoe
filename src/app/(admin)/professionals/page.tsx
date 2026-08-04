import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth";
import { getActiveProfessionals } from "@/modules/professionals/services/professional-queries";

export const metadata = {
  title: "Profissionais — ClinicaZoe",
};

const STAFF_ROLES = ["admin", "recepcionista"];

export default async function ProfessionalsPage() {
  const session = await getCurrentUser();
  if (!session || !STAFF_ROLES.includes(session.profile.role)) redirect("/dashboard");

  const professionals = await getActiveProfessionals();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#F5F7F6]">Profissionais</h1>
        <p className="mt-1 text-sm text-[#C8D4CF]">
          Consulta de profissionais ativos e seus horários de atendimento.
        </p>
      </div>

      {professionals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#255044] bg-[#102A22] p-12 text-center text-sm font-medium text-[#C8D4CF]">
          Nenhum profissional ativo cadastrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {professionals.map((professional) => (
            <Link key={professional.id} href={`/professionals/${professional.id}`}>
              <Card className="h-full transition-all hover:border-[#2E8B57] hover:shadow-[0_15px_40px_rgba(11,61,46,0.3)]">
                <CardContent className="flex flex-col justify-between gap-4 py-6">
                  <div className="flex items-center gap-4">
                    <Avatar src={professional.avatarUrl} name={professional.full_name} size={52} />
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-[#F5F7F6]">
                        {professional.full_name}
                      </p>
                      {professional.specialtyName && (
                        <p className="truncate text-sm font-medium text-[#5ED39D] mt-0.5">
                          {professional.specialtyName}
                        </p>
                      )}
                    </div>
                  </div>
                  {professional.licenseNumber && (
                    <Badge tone="neutral" className="w-fit">{professional.licenseNumber}</Badge>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

