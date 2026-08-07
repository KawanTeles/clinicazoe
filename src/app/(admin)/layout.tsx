import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAvatarSignedUrl } from "@/lib/supabase/storage";
import { getPermissions } from "@/lib/permissions";
import { NAV_ITEMS } from "@/lib/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { getNotifications, getUnreadCount } from "@/modules/notifications/services/notification-queries";
import { getClinicLogoUrl, getClinicSettings } from "@/modules/settings/services/settings-queries";
import { getPendingRequestsCount } from "@/modules/requests/services/request-queries";
import { getWaitlistUnseenCount } from "@/modules/waitlist/services/waitlist-queries";

// Painel administrativo: rota inteira é privada. Definido no layout para
// cobrir todas as ~30 páginas do grupo (admin) de uma vez só — páginas
// filhas que não redefinem `robots` herdam este valor automaticamente.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUser();

  if (!session) {
    redirect("/login");
  }

  const { profile } = session;
  const supabase = await createClient();
  const [avatarUrl, permissions, notifications, unreadCount, clinicSettings, pendingRequestsCount, waitlistCount] =
    await Promise.all([
      getAvatarSignedUrl(supabase, profile.avatar_path, profile.avatar_url),
      getPermissions(profile.role),
      getNotifications(session.user.id),
      getUnreadCount(session.user.id),
      getClinicSettings(),
      getPendingRequestsCount(),
      getWaitlistUnseenCount(),
    ]);
  const logoUrl = await getClinicLogoUrl(clinicSettings?.logo_path ?? null);

  const items = NAV_ITEMS.filter((item) => permissions.has(item.permission));

  return (
    <AdminShell
      items={items}
      fullName={profile.full_name || session.user.email || "Usuário"}
      role={profile.role}
      avatarUrl={avatarUrl}
      notifications={notifications}
      unreadCount={unreadCount}
      pendingRequestsCount={pendingRequestsCount}
      waitlistCount={waitlistCount}
      clinicName={clinicSettings?.name || "ClinicaZoe"}
      logoUrl={logoUrl}
    >
      {children}
    </AdminShell>
  );
}
