import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
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
    <div className="flex flex-col gap-4 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary font-heading">Editar Membro</h1>
          <p className="mt-0.5 text-xs text-text-secondary">{profile.full_name}</p>
        </div>
        {profile.role === "profissional" && (
          <Link href={`/team/${profile.id}/schedule`}>
            <Button variant="secondary">Gerenciar horários</Button>
          </Link>
        )}
      </div>

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
          insurances: professionalInsurances.map((i) => ({
            insurance_id: i.insurance_id,
            modality: i.modality,
            value: i.value.toString(),
            duration_minutes: i.duration_minutes?.toString() ?? "",
          })),
        }}
      />
    </div>
  );
}

