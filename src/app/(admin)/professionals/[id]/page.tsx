import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth";
import { getActiveProfessional } from "@/modules/professionals/services/professional-queries";
import { getScheduleForProfessional } from "@/modules/schedule/services/schedule-queries";
import { DAY_LABELS } from "@/modules/schedule/constants";

export const metadata = {
  title: "Profissional — ClinicaZoe",
};

const STAFF_ROLES = ["admin", "recepcionista"];

export default async function ProfessionalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getCurrentUser();
  if (!session || !STAFF_ROLES.includes(session.profile.role)) redirect("/dashboard");

  const { id } = await params;
  const result = await getActiveProfessional(id);
  if (!result) notFound();

  const { profile, professional, specialtyName, insuranceNames, avatarUrl } = result;
  const slots = (await getScheduleForProfessional(id)).filter((slot) => slot.status === "active");

  return (
    <div className="flex flex-col gap-6">
      <Link href="/professionals" className="text-sm text-text-secondary hover:text-text-primary">
        ← Voltar para Profissionais
      </Link>

      <Card>
        <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-start">
          <Avatar src={avatarUrl} name={profile.full_name} size={72} />
          <div className="flex flex-col gap-2">
            <div>
              <h1 className="text-xl font-semibold text-text-primary">{profile.full_name}</h1>
              {specialtyName && <p className="text-sm text-text-secondary">{specialtyName}</p>}
            </div>
            {professional?.license_number && (
              <Badge tone="neutral" className="w-fit">
                {professional.license_number}
              </Badge>
            )}
            {professional?.bio && <p className="text-sm text-text-secondary">{professional.bio}</p>}
            {insuranceNames.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {insuranceNames.map((name) => (
                  <Badge key={name} tone="success">
                    {name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horários de atendimento</CardTitle>
        </CardHeader>
        <CardContent>
          {slots.length === 0 ? (
            <p className="text-sm text-text-secondary">Nenhum horário disponível no momento.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-text-secondary">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Dia</th>
                    <th className="py-2 pr-4 font-medium">Horário</th>
                    <th className="py-2 pr-4 font-medium">Convênios</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {slots.map((slot) => (
                    <tr key={slot.id}>
                      <td className="py-2 pr-4 text-text-primary">{DAY_LABELS[slot.day_of_week]}</td>
                      <td className="py-2 pr-4 text-text-primary">
                        {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                      </td>
                      <td className="py-2 pr-4">
                        {slot.insuranceNames.length === 0 ? (
                          <Badge tone="neutral">Todos</Badge>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {slot.insuranceNames.map((name) => (
                              <Badge key={name} tone="neutral">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
