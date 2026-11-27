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
import { BOTTOM_TAB_ICONS, BottomTabBar } from "@/components/layout/BottomTabBar";
import { renderNavIcon } from "@/components/layout/nav-icons";
import { InactivityLogout } from "@/components/layout/InactivityLogout";

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
  /** Evoluções pendentes do profissional (soma entre pacientes) — badge da
   * aba "Evolução" do menu inferior mobile. */
  pendingEvolutionsCount?: number;
  children: React.ReactNode;
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
  pendingEvolutionsCount = 0,
  children,
}: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Menu inferior tipo app: por ora só para quem atende (role 'profissional',
  // puro ou acumulando Coordenação — a coluna is_coordinator só existe sobre
  // esse papel). Admin, recepcionista, paciente e Coordenação pura continuam
  // exatamente como hoje (sidebar em overlay no mobile).
  const showBottomTabBar = role === "profissional";

  const bottomTabItems = [
    { key: "hoje", label: "Hoje", href: "/hoje", icon: BOTTOM_TAB_ICONS.today },
    {
      key: "evolucao",
      label: "Evolução",
      href: "/nova-evolucao",
      icon: BOTTOM_TAB_ICONS.evolution,
      badge: pendingEvolutionsCount,
    },
    {
      key: "pacientes",
      label: "Pacientes",
      href: "/my-patients",
      icon: BOTTOM_TAB_ICONS.patients,
    },
    {
      key: "avisos",
      label: "Avisos",
      href: "/avisos",
      icon: BOTTOM_TAB_ICONS.alerts,
      badge: unreadCount,
    },
    { key: "mais", label: "Mais", href: "/mais", icon: BOTTOM_TAB_ICONS.more },
  ];

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
    "/faltas": "Atendimento & Agenda",
    "/my-schedule": "Atendimento & Agenda",
    "/my-patients": "Atendimento & Agenda",
    "/patients": "Atendimento & Agenda",
    "/professionals": "Gestão & Clínica",
    "/team": "Gestão & Clínica",
    "/users": "Gestão & Clínica",
    "/specialties": "Gestão & Clínica",
    "/insurances": "Gestão & Clínica",
    "/financial": "Gestão & Clínica",
    "/reports": "Gestão & Clínica",
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
          "fixed inset-y-0 left-0 z-50 flex w-60 h-screen flex-col shrink-0 border-r border-border/80 bg-admin-sidebar backdrop-blur-xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        )}
      >
        {/* Sidebar Brand Header */}
        <div className="flex h-14 shrink-0 items-center justify-between px-4 border-b border-border/80">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5 group">
            <Image
              src={logoUrl || "/brand-logo.png?v=3"}
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
              <span className="text-[9px] font-semibold text-primary uppercase tracking-wider">
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
                          ? "bg-[var(--primary)]/10 text-[var(--primary-dark)] font-bold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r-full before:bg-[var(--primary)]"
                          : "text-text-secondary hover:bg-card-elevated/60 hover:text-text-primary font-medium"
                      )}
                    >
                      <span className={cn("relative shrink-0 flex items-center justify-center w-4 h-4 transition-transform group-hover:scale-105", active ? "text-[var(--primary)]" : "text-text-muted group-hover:text-text-primary")}>
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
            {!showBottomTabBar && (
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
            )}
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
            <NotificationBell initialNotifications={notifications} initialUnreadCount={unreadCount} />
            <div className="hidden md:flex items-center gap-2 border-l border-border/80 pl-2.5">
              <Avatar src={avatarUrl} name={fullName} size={28} />
              <span className="text-xs font-semibold text-text-primary max-w-[120px] truncate">{fullName}</span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main
          className={cn(
            "flex-1 min-h-0 overflow-y-auto bg-admin-content p-3.5 sm:p-5 lg:p-6",
            showBottomTabBar && "pb-[calc(4rem+env(safe-area-inset-bottom,0px)+0.75rem)]",
          )}
        >
          {children}
        </main>
      </div>

      {showBottomTabBar && <BottomTabBar items={bottomTabItems} />}
      <InactivityLogout />
    </div>
  );
}
