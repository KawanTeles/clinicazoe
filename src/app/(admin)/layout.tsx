import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAvatarDisplayUrl } from "@/lib/supabase/storage";
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
      getAvatarDisplayUrl(supabase, profile.avatar_path, profile.role, profile.avatar_url),
      getPermissions(profile),
      getNotifications(session.user.id),
      getUnreadCount(session.user.id),
      getClinicSettings(),
      getPendingRequestsCount(),
      getWaitlistUnseenCount(),
    ]);
  const logoUrl = await getClinicLogoUrl(clinicSettings?.logo_path ?? null);

  // NAV_ITEMS lista o mesmo destino mais de uma vez de propósito, uma entrada
  // por permissão que o alcança ("Agenda" via appointments.view.own e via
  // appointments.manage, por exemplo). Até a Etapa 78 isso nunca duplicava na
  // tela porque os papéis eram mutuamente exclusivos — ninguém tinha as duas
  // permissões. Com o acúmulo de função (terapeuta + coordenação) isso deixou
  // de ser verdade, então o menu precisa ficar com uma entrada por destino.
  const vistos = new Set<string>();
  const items = NAV_ITEMS.filter((item) => {
    if (!permissions.has(item.permission)) return false;
    const chave = `${item.href}|${item.label}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });

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
      clinicName={clinicSettings?.name || "Espaço Zoe"}
      logoUrl={logoUrl}
    >
      {children}
    </AdminShell>
  );
}
