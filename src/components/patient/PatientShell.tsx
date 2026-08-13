"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils/cn";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { DeveloperSignature } from "@/components/public/DeveloperSignature";
import { PatientSignOutButton } from "@/components/patient/PatientSignOutButton";

interface PatientShellProps {
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  clinicName: string;
  logoUrl: string | null;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: "/cliente", label: "Dashboard", icon: "dashboard" },
  { href: "/cliente/agendar", label: "Agendar Atendimento", icon: "calendar-plus" },
  { href: "/cliente/perfil", label: "Meu Perfil", icon: "user" },
] as const;

function renderNavIcon(icon: (typeof NAV_ITEMS)[number]["icon"]) {
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
    case "user":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
  }
}

export function PatientShell({ fullName, phone, avatarUrl, clinicName, logoUrl, children }: PatientShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-text-primary">
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
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-4 border-b border-border/80">
          <Link href="/cliente" className="flex min-w-0 items-center gap-2.5 group">
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
                Área do Paciente
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

        <nav className="flex-1 min-h-0 space-y-0.5 pl-2.5 pr-1.5 py-3 overflow-y-auto sidebar-scrollbar">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || (item.href !== "/cliente" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "group relative flex h-8.5 items-center gap-2.5 rounded-lg px-2.5 text-xs font-semibold transition-all duration-150",
                  active
                    ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-300 font-bold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r-full before:bg-emerald-600 dark:before:bg-emerald-400"
                    : "text-text-secondary hover:bg-card-elevated/60 hover:text-text-primary font-medium",
                )}
              >
                <span className={cn("shrink-0 flex items-center justify-center w-4 h-4 transition-transform group-hover:scale-105", active ? "text-emerald-600 dark:text-emerald-400" : "text-text-muted group-hover:text-text-primary")}>
                  {renderNavIcon(item.icon)}
                </span>
                <span className="truncate tracking-tight">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-border/80 bg-card-elevated/50 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar src={avatarUrl} name={fullName} size={30} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-text-primary leading-tight">{fullName}</p>
                <span className="text-[10px] font-semibold text-text-muted truncate block">{phone || "Paciente"}</span>
              </div>
            </div>
            <PatientSignOutButton />
          </div>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div className="flex min-w-0 flex-1 flex-col h-screen overflow-hidden">
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
              <span>Painel do Paciente</span>
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
          </div>
        </header>

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
