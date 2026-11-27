import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getNotifications, getUnreadCount } from "@/modules/notifications/services/notification-queries";
import { NotificationsScreen } from "@/modules/notifications/components/NotificationsScreen";

export const metadata = {
  title: "Avisos — Espaço Zoe",
};

export default async function AvisosPage() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") redirect("/dashboard");

  const [notifications, unreadCount] = await Promise.all([
    getNotifications(session.user.id),
    getUnreadCount(session.user.id),
  ]);

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">Avisos</h1>
        <p className="mt-1 text-sm text-text-secondary">Notificações da clínica e som de alerta.</p>
      </div>

      <NotificationsScreen initialNotifications={notifications} initialUnreadCount={unreadCount} />
    </div>
  );
}
