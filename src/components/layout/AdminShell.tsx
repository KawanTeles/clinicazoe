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
import { ThemeToggle } from "@/components/theme/ThemeToggle";
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
  pendingRequestsCount?: number;
  waitlistCount?: number;
  clinicName: string;
  logoUrl: string | null;
  children: React.ReactNode;
}

function renderNavIcon(icon?: string) {
  switch (icon) {
    case "dashboard":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "calendar-plus":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="12" y1="14" x2="12" y2="18" />
          <line x1="10" y1="16" x2="14" y2="16" />
        </svg>
      );
    case "calendar":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case "bell":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case "dollar-sign":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    case "clock":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "waitlist":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <circle cx="18" cy="7.5" r="3.2" strokeDasharray="1.5 2.2" />
          <path d="M18 6v1.7l1.1 1" />
        </svg>
      );
    case "users":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "user-check":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <polyline points="17 11 19 13 23 9" />
        </svg>
      );
    case "shield":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "stethoscope":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.8 2.3A.3.3 0 0 0 4.5 2h-1a.3.3 0 0 0-.3.3v7.4a7 7 0 0 0 14 0V2.3a.3.3 0 0 0-.3-.3h-1a.3.3 0 0 0-.3.3v7.4a4.4 4.4 0 0 1-8.8 0V2.3z" />
          <path d="M11 16.7A7 7 0 0 0 18 23" />
          <circle cx="18" cy="18" r="3" />
        </svg>
      );
    case "building":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
          <path d="M9 22v-4h6v4" />
          <path d="M8 6h.01" />
          <path d="M16 6h.01" />
          <path d="M12 6h.01" />
          <path d="M12 10h.01" />
          <path d="M12 14h.01" />
          <path d="M16 10h.01" />
          <path d="M16 14h.01" />
          <path d="M8 10h.01" />
          <path d="M8 14h.01" />
        </svg>
      );
    case "clipboard":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <line x1="9" y1="12" x2="15" y2="12" />
          <line x1="9" y1="16" x2="15" y2="16" />
          <line x1="9" y1="8" x2="11" y2="8" />
        </svg>
      );
    case "activity":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      );
    case "settings":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case "user":
    default:
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
  }
}

export function AdminShell({
  items,
  fullName,
  role,
  avatarUrl,
  notifications,
  unreadCount,
  pendingRequestsCount = 0,
  waitlistCount = 0,
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

  // Deduplicate items with identical href if any
  const uniqueItems = items.filter(
    (item, index, self) => index === self.findIndex((t) => t.href === item.href && t.label === item.label)
  );

  // Group items into SaaS navigation categories
  const CATEGORY_MAP: Record<string, string> = {
    "/dashboard": "Visão Geral",
    "/book": "Visão Geral",
    "/requests": "Visão Geral",
    "/waitlist": "Atendimento & Agenda",
    "/appointments": "Atendimento & Agenda",
    "/my-schedule": "Atendimento & Agenda",
    "/my-patients": "Atendimento & Agenda",
    "/patients": "Atendimento & Agenda",
    "/professionals": "Gestão & Clínica",
    "/team": "Gestão & Clínica",
    "/users": "Gestão & Clínica",
    "/specialties": "Gestão & Clínica",
    "/insurances": "Gestão & Clínica",
    "/financial": "Gestão & Clínica",
    "/audit": "Sistema",
    "/settings": "Sistema",
    "/profile": "Sistema",
  };

  const groupedNav = uniqueItems.reduce<Record<string, NavItem[]>>((acc, item) => {
    const category = CATEGORY_MAP[item.href] || "Outros";
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {});

  const CATEGORY_ORDER = ["Visão Geral", "Atendimento & Agenda", "Gestão & Clínica", "Sistema", "Outros"];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-text-primary">
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
          "fixed inset-y-0 left-0 z-50 flex w-60 h-screen flex-col shrink-0 border-r border-border/80 bg-card/95 backdrop-blur-xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        )}
      >
        {/* Sidebar Brand Header */}
        <div className="flex h-14 shrink-0 items-center justify-between px-4 border-b border-border/80">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5 group">
            <Image
              src={logoUrl || "/brand-logo.png"}
              alt={clinicName}
              width={32}
              height={32}
              unoptimized
              className="h-8 w-8 rounded-full object-cover border border-border group-hover:scale-105 transition-transform"
            />
            <div className="flex flex-col min-w-0">
              <span className="truncate text-xs font-bold tracking-tight text-text-primary font-heading">
                {clinicName}
              </span>
              <span className="text-[9px] font-semibold text-primary dark:text-[var(--link)] uppercase tracking-wider">
                SaaS Admin
              </span>
            </div>
          </Link>
          <button
            aria-label="Fechar menu"
            className="rounded-lg p-1 text-text-secondary transition-colors hover:bg-card-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Sidebar Nav Items (Grouped with categories) */}
        <nav className="flex-1 min-h-0 space-y-3 pl-2.5 pr-1.5 py-3 overflow-y-auto sidebar-scrollbar">
          {CATEGORY_ORDER.map((categoryTitle) => {
            const groupItems = groupedNav[categoryTitle];
            if (!groupItems || groupItems.length === 0) return null;

            return (
              <div key={categoryTitle} className="space-y-0.5">
                <div className="px-2.5 pt-1.5 pb-1 text-[9.5px] font-extrabold uppercase tracking-wider text-text-muted/70 font-heading">
                  {categoryTitle}
                </div>
                {groupItems.map((item) => {
                  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
                  return (
                    <Link
                      key={`${item.href}-${item.label}`}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "group relative flex h-8.5 items-center gap-2.5 rounded-lg px-2.5 text-xs font-semibold transition-all duration-150",
                        active
                          ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-300 font-bold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r-full before:bg-emerald-600 dark:before:bg-emerald-400"
                          : "text-text-secondary hover:bg-card-elevated/60 hover:text-text-primary font-medium"
                      )}
                    >
                      <span className={cn("relative shrink-0 flex items-center justify-center w-4 h-4 transition-transform group-hover:scale-105", active ? "text-emerald-600 dark:text-emerald-400" : "text-text-muted group-hover:text-text-primary")}>
                        {renderNavIcon(item.icon)}
                        {item.href === "/requests" && pendingRequestsCount > 0 && (
                          <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white shadow-[0_0_6px_var(--danger)]">
                            {pendingRequestsCount > 9 ? "9+" : pendingRequestsCount}
                          </span>
                        )}
                        {item.href === "/waitlist" && waitlistCount > 0 && (
                          <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white shadow-[0_0_6px_var(--danger)]">
                            {waitlistCount > 9 ? "9+" : waitlistCount}
                          </span>
                        )}
                      </span>
                      <span className="truncate tracking-tight">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Compact Integrated User Footer */}
        <div className="shrink-0 border-t border-border/80 bg-card-elevated/50 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar src={avatarUrl} name={fullName} size={30} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-text-primary leading-tight">{fullName}</p>
                <span className="text-[10px] font-semibold text-text-muted truncate block">
                  {ROLE_LABELS[role] ?? role}
                </span>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              title="Sair da conta"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-card text-text-secondary hover:bg-danger/15 hover:text-danger hover:border-danger/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
              aria-label="Sair da conta"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div className="flex min-w-0 flex-1 flex-col h-screen overflow-hidden">
        {/* Fixed Top Header */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-background/80 px-4 sm:px-6 backdrop-blur-md transition-all">
          <div className="flex items-center gap-3">
            <button
              aria-label="Abrir menu"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-text-primary transition-colors hover:bg-card-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-text-muted">
              <span>Painel</span>
              <span>/</span>
              <span className="font-bold text-text-primary">{clinicName}</span>
            </div>
            <span className="text-sm font-semibold text-text-primary font-heading sm:hidden">{clinicName}</span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-card-elevated hover:border-primary/50 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" x2="22" y1="12" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10z" />
              </svg>
              <span>Ver Site</span>
            </Link>
            <ThemeToggle />
            <NotificationBell initialNotifications={notifications} initialUnreadCount={unreadCount} />
            <div className="hidden md:flex items-center gap-2 border-l border-border/80 pl-2.5">
              <Avatar src={avatarUrl} name={fullName} size={28} />
              <span className="text-xs font-semibold text-text-primary max-w-[120px] truncate">{fullName}</span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-5 lg:p-6 flex flex-col justify-between">
          <div>{children}</div>
          <footer className="mt-12 border-t border-border/40 pt-4 pb-2">
            <DeveloperSignature />
          </footer>
        </main>
      </div>
    </div>
  );
}
