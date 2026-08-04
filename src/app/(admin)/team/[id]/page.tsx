import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAvatarSignedUrl } from "@/lib/supabase/storage";
import { getTeamMember } from "@/modules/team/services/team-queries";
import { getActiveSpecialties } from "@/modules/specialties/services/specialty-queries";
import { getActiveInsurances } from "@/modules/insurances/services/insurance-queries";
import { TeamMemberForm } from "@/modules/team/components/TeamMemberForm";

export const metadata = {
  title: "Editar membro — ClinicaZoe",
};

export default async function EditTeamMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const result = await getTeamMember(id);
  if (!result) notFound();

  const { profile, professional, insurances: professionalInsurances, email } = result;
  const supabase = await createClient();
  const [avatarUrl, specialties, insurances] = await Promise.all([
    getAvatarSignedUrl(supabase, profile.avatar_path),
    getActiveSpecialties(),
    getActiveInsurances(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F5F7F6]">Editar membro</h1>
          <p className="mt-1 text-sm text-[#C8D4CF]">{profile.full_name}</p>
        </div>
        {profile.role === "profissional" && (
          <Link href={`/team/${profile.id}/schedule`}>
            <Button variant="secondary">Gerenciar horários</Button>
          </Link>
        )}
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Dados do membro</CardTitle>
        </CardHeader>
        <CardContent>
          <TeamMemberForm
            mode="edit"
            memberId={profile.id}
            isSelf={profile.id === session.user.id}
            avatarUrl={avatarUrl}
            specialties={specialties}
            insurances={insurances}
            initial={{
              full_name: profile.full_name,
              email,
              phone: profile.phone ?? "",
              role: profile.role,
              status: profile.status,
              specialty_id: professional?.specialty_id ?? "",
              license_number: professional?.license_number ?? "",
              bio: professional?.bio ?? "",
              agenda_color: professional?.agenda_color ?? "#2E8B57",
              consultation_duration_minutes: String(
                professional?.consultation_duration_minutes ?? 30,
              ),
              price_particular_card: professional?.price_particular_card?.toString() ?? "",
              price_particular_pix: professional?.price_particular_pix?.toString() ?? "",
              price_particular_cash: professional?.price_particular_cash?.toString() ?? "",
              insurances: professionalInsurances.map((i) => ({
                insurance_id: i.insurance_id,
                value: i.value.toString(),
              })),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

