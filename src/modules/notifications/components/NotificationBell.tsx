"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/modules/notifications/services/notification-actions";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

const relativeFormatter = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

function relativeTime(iso: string) {
  const diffMs = new Date(iso).getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  if (Math.abs(diffMin) < 60) return relativeFormatter.format(diffMin, "minute");
  const diffHours = Math.round(diffMin / 60);
  if (Math.abs(diffHours) < 24) return relativeFormatter.format(diffHours, "hour");
  return relativeFormatter.format(Math.round(diffHours / 24), "day");
}

export function NotificationBell({
  initialNotifications,
  initialUnreadCount,
}: {
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  async function handleOpen() {
    setOpen((prev) => !prev);
  }

  async function handleMarkRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    await markNotificationRead(id);
    router.refresh();
  }

  async function handleMarkAll() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setUnreadCount(0);
    await markAllNotificationsRead();
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notificações"
        onClick={handleOpen}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#255044] bg-[#102A22] text-[#C8D4CF] transition-all hover:border-[#2E8B57]/50 hover:bg-[#17382D] hover:text-[#F5F7F6]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 4.5 1.5 6 2 7H4c.5-1 2-2.5 2-7Z" />
          <path d="M9.5 18a2.5 2.5 0 0 0 5 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#2E8B57] px-1 text-[10px] font-bold text-white shadow-[0_0_8px_#2E8B57]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            aria-label="Fechar notificações"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-40 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-2xl border border-[#255044] bg-[#102A22] shadow-[0_15px_40px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between border-b border-[#255044] bg-[#17382D]/60 px-4 py-3">
              <p className="text-sm font-bold text-[#F5F7F6]">Notificações</p>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAll}
                  className="text-xs font-semibold text-[#5ED39D] hover:text-[#86E5B8] hover:underline"
                >
                  Marcar todas como lidas
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-[#255044]/50">
              {notifications.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-[#7A9187]">
                  Nenhuma notificação ainda.
                </p>
              )}
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => !notification.read_at && handleMarkRead(notification.id)}
                  className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-[#17382D]/70 ${
                    notification.read_at ? "" : "bg-[#2E8B57]/15"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {!notification.read_at && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-[#5ED39D] shadow-[0_0_6px_#5ED39D]" />
                    )}
                    <p className="text-sm font-semibold text-[#F5F7F6]">{notification.title}</p>
                  </div>
                  <p className="text-xs text-[#C8D4CF] leading-relaxed">{notification.message}</p>
                  <p className="text-[11px] text-[#7A9187]">
                    {relativeTime(notification.created_at)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

