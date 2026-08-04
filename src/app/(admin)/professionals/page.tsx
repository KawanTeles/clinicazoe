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
        <h1 className="text-xl font-semibold text-text-primary">Profissionais</h1>
        <p className="text-sm text-text-secondary">
          Consulta de profissionais ativos e seus horários. Somente leitura.
        </p>
      </div>

      {professionals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-text-secondary">
          Nenhum profissional ativo cadastrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {professionals.map((professional) => (
            <Link key={professional.id} href={`/professionals/${professional.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex flex-col gap-3 py-5">
                  <div className="flex items-center gap-3">
                    <Avatar src={professional.avatarUrl} name={professional.full_name} size={48} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-text-primary">
                        {professional.full_name}
                      </p>
                      {professional.specialtyName && (
                        <p className="truncate text-sm text-text-secondary">
                          {professional.specialtyName}
                        </p>
                      )}
                    </div>
                  </div>
                  {professional.licenseNumber && (
                    <Badge tone="neutral">{professional.licenseNumber}</Badge>
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
