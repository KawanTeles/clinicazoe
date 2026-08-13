import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAvatarSignedUrl } from "@/lib/supabase/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ProfileForm } from "@/modules/users/components/ProfileForm";

export const metadata = {
  title: "Meu Perfil — Espaço Zoe",
};

export default async function PatientPerfilPage() {
  const session = await getCurrentUser();
  if (!session) return null;

  const supabase = await createClient();
  const avatarUrl = await getAvatarSignedUrl(supabase, session.profile.avatar_path, session.profile.avatar_url);

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
