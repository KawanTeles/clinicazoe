import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import { resolveNavItems, ROLE_LABELS } from "@/lib/navigation";
import { getAvatarDisplayUrl } from "@/lib/supabase/storage";
import { createClient } from "@/lib/supabase/server";
import { MaisScreen } from "@/modules/settings/components/MaisScreen";

export const metadata = {
  title: "Mais — Espaço Zoe",
};

// "Meus Pacientes"/"Pacientes" já têm aba própria no menu inferior — evita
// duplicar. "/evolutions" fica: é a busca/histórico entre pacientes, papel
// diferente da aba "Evolução" (que só lista pendências para criar agora).
const HIDDEN_HREFS = new Set(["/my-patients", "/patients"]);

export default async function MaisPage() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") redirect("/dashboard");

  const { profile } = session;
  const supabase = await createClient();
  const [permissions, avatarUrl] = await Promise.all([
    getPermissions(profile),
    getAvatarDisplayUrl(supabase, profile.avatar_path, profile.role, profile.avatar_url),
  ]);

  const items = resolveNavItems(permissions).filter((item) => !HIDDEN_HREFS.has(item.href));

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">Mais</h1>
        <p className="mt-1 text-sm text-text-secondary">Perfil, financeiro, relatórios e configurações.</p>
      </div>

      <MaisScreen
        fullName={profile.full_name || session.user.email || "Usuário"}
        roleLabel={ROLE_LABELS[profile.role] ?? profile.role}
        avatarUrl={avatarUrl}
        items={items}
      />
    </div>
  );
}
