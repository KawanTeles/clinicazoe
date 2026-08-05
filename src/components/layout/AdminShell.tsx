"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { ROLE_LABELS, type NavItem } from "@/lib/navigation";
import { signOut } from "@/modules/auth/services/auth-client";
import { NotificationBell } from "@/modules/notifications/components/NotificationBell";
import { DeveloperSignature } from "@/components/public/DeveloperSignature";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

interface AdminShellProps {
  items: NavItem[];
  fullName: string;
  role: string;
  avatarUrl: string | null;
  notifications: NotificationItem[];
  unreadCount: number;
  clinicName: string;
  logoUrl: string | null;
  children: React.ReactNode;
}

export function AdminShell({
  items,
  fullName,
  role,
  avatarUrl,
  notifications,
  unreadCount,
  clinicName,
  logoUrl,
  children,
}: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/equipe");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen w-full bg-[#081C15]">
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[#255044] bg-[#081C15] transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
        )}
      >
        {/* Sidebar Brand Header */}
        <div className="flex h-16 shrink-0 items-center justify-between px-6 border-b border-[#255044]/50 bg-[#081C15]">
          <div className="flex min-w-0 items-center gap-3">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={clinicName}
                width={32}
                height={32}
                unoptimized
                className="h-8 w-8 rounded-xl object-contain bg-[#17382D] p-1 border border-[#255044]"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-forest text-xs font-bold text-white shadow-md">
                CZ
              </div>
            )}
            <span className="truncate text-base font-bold tracking-tight text-[#F5F7F6]">
              {clinicName}
            </span>
          </div>
          <button
            aria-label="Fechar menu"
            className="rounded-lg p-1.5 text-[#C8D4CF] transition-colors hover:bg-[#17382D] hover:text-[#F5F7F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E8B57] focus-visible:ring-offset-2 focus-visible:ring-offset-[#081C15] lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 space-y-1.5 px-3 py-4 overflow-y-auto">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "relative flex h-11 items-center rounded-xl px-3.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-[#2E8B57]/15 text-[#5ED39D] font-semibold shadow-[0_0_15px_rgba(46,139,87,0.15)] before:absolute before:left-0 before:top-2.5 before:bottom-2.5 before:w-1 before:rounded-r-full before:bg-[#5ED39D] before:shadow-[0_0_8px_#5ED39D]"
                    : "text-[#C8D4CF] hover:bg-[#17382D]/70 hover:text-[#F5F7F6]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer User Info */}
        <div className="border-t border-[#255044] bg-[#102A22]/80 p-4">
          <div className="flex items-center gap-3">
            <Avatar src={avatarUrl} name={fullName} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#F5F7F6]">{fullName}</p>
              <Badge tone="success" className="mt-1 text-[11px] py-0 px-2">
                {ROLE_LABELS[role] ?? role}
              </Badge>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="mt-3 w-full justify-center" onClick={handleSignOut}>
            Sair da conta
          </Button>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Fixed Glassmorphism Top Header */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-[#255044] bg-[#17382D]/80 px-4 sm:px-6 backdrop-blur-md transition-all">
          <div className="flex items-center gap-3">
            <button
              aria-label="Abrir menu"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#255044] bg-[#102A22] text-[#F5F7F6] transition-colors hover:bg-[#17382D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E8B57] focus-visible:ring-offset-2 focus-visible:ring-offset-[#081C15] lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <span className="sr-only">Abrir menu</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            </button>
            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-medium text-[#7A9187]">Painel Administrativo</span>
              <span className="text-sm font-bold text-[#F5F7F6]">{clinicName}</span>
            </div>
            <span className="text-base font-semibold text-[#F5F7F6] sm:hidden">{clinicName}</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#255044] bg-[#102A22] px-3 py-1.5 text-xs font-semibold text-[#5ED39D] hover:bg-[#17382D] hover:border-[#2E8B57] transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" x2="22" y1="12" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>Ver Site</span>
            </Link>
            <NotificationBell initialNotifications={notifications} initialUnreadCount={unreadCount} />
            <div className="hidden md:flex items-center gap-2 border-l border-[#255044] pl-4">
              <Avatar src={avatarUrl} name={fullName} size={32} />
              <span className="text-xs font-semibold text-[#F5F7F6] max-w-[120px] truncate">{fullName}</span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex flex-1 flex-col justify-between overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <div>{children}</div>
          <footer className="mt-8 border-t border-[#255044]/40 pt-2 pb-2">
            <DeveloperSignature />
          </footer>
        </main>
      </div>
    </div>
  );
}

