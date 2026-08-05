import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/navigation";
import { getUserDetail } from "@/modules/user-management/services/user-queries";
import { UserEditForm } from "@/modules/user-management/components/UserEditForm";

export const metadata = {
  title: "Editar usuário — ClinicaZoe",
};

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const result = await getUserDetail(id);
  if (!result) notFound();

  const { profile, email, avatarUrl, appointmentsCount } = result;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Editar usuário</h1>
          <p className="mt-1 text-sm text-text-secondary">{profile.full_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="neutral">{ROLE_LABELS[profile.role] ?? profile.role}</Badge>
          {appointmentsCount > 0 && (
            <Badge tone="warning">{appointmentsCount} consulta(s) vinculada(s)</Badge>
          )}
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Dados do usuário</CardTitle>
        </CardHeader>
        <CardContent>
          <UserEditForm
            userId={profile.id}
            isSelf={profile.id === session.user.id}
            avatarUrl={avatarUrl}
            initial={{
              full_name: profile.full_name,
              email,
              phone: profile.phone ?? "",
              role: profile.role,
              status: profile.status,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
