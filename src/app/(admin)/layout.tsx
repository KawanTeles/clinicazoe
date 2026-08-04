import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAvatarSignedUrl } from "@/lib/supabase/storage";
import { getPermissions } from "@/lib/permissions";
import { NAV_ITEMS } from "@/lib/navigation";
import { AdminShell } from "@/components/layout/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUser();

  if (!session) {
    redirect("/login");
  }

  const { profile } = session;
  const supabase = await createClient();
  const [avatarUrl, permissions] = await Promise.all([
    getAvatarSignedUrl(supabase, profile.avatar_path),
    getPermissions(profile.role),
  ]);

  const items = NAV_ITEMS.filter((item) => permissions.has(item.permission));

  return (
    <AdminShell
      items={items}
      fullName={profile.full_name || session.user.email || "Usuário"}
      role={profile.role}
      avatarUrl={avatarUrl}
    >
      {children}
    </AdminShell>
  );
}
