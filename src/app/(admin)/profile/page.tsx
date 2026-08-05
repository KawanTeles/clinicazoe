import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAvatarSignedUrl } from "@/lib/supabase/storage";
import { ProfileForm } from "@/modules/users/components/ProfileForm";

export const metadata = {
  title: "Meu Perfil — ClinicaZoe",
};

export default async function ProfilePage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const supabase = await createClient();
  const avatarUrl = await getAvatarSignedUrl(supabase, session.profile.avatar_path);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Meu Perfil</h1>
        <p className="mt-1 text-sm text-text-secondary">Atualize seus dados pessoais e foto.</p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            userId={session.user.id}
            initialFullName={session.profile.full_name}
            initialPhone={session.profile.phone ?? ""}
            avatarUrl={avatarUrl}
          />
        </CardContent>
      </Card>
    </div>
  );
}

