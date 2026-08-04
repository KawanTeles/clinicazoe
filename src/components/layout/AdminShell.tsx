"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { ROLE_LABELS, type NavItem } from "@/lib/navigation";
import { signOut } from "@/modules/auth/services/auth-client";

interface AdminShellProps {
  items: NavItem[];
  fullName: string;
  role: string;
  avatarUrl: string | null;
  children: React.ReactNode;
}

export function AdminShell({ items, fullName, role, avatarUrl, children }: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen w-full">
      {mobileOpen && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-white transition-transform duration-200 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center px-6">
          <span className="text-lg font-semibold text-primary-dark">ClinicaZoe</span>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex h-10 items-center rounded-lg px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary-dark"
                    : "text-text-secondary hover:bg-bg-soft hover:text-text-primary",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <Avatar src={avatarUrl} name={fullName} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">{fullName}</p>
              <Badge tone="success" className="mt-0.5">
                {ROLE_LABELS[role] ?? role}
              </Badge>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={handleSignOut}>
            Sair
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-border bg-white px-4 lg:hidden">
          <button
            aria-label="Abrir menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-bg-soft"
            onClick={() => setMobileOpen(true)}
          >
            <span className="sr-only">Abrir menu</span>
            ☰
          </button>
          <span className="text-base font-semibold text-primary-dark">ClinicaZoe</span>
        </header>

        <main className="flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
