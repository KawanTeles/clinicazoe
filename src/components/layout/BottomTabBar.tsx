"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

interface BottomTabItem {
  key: string;
  label: string;
  href: string;
  icon: (active: boolean) => React.ReactNode;
  badge?: number;
  /** Ativa também quando a rota atual é uma sub-rota deste caminho (ex: /patients/[id]). */
  matchPrefix?: string[];
}

interface BottomTabBarProps {
  items: BottomTabItem[];
}

function TabIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export const BOTTOM_TAB_ICONS = {
  today: (active: boolean) => (
    <TabIcon>
      <rect x="3" y="4" width="18" height="18" rx="2.5" />
      <line x1="3" y1="10" x2="21" y2="10" />
      {active && <circle cx="12" cy="15.5" r="2" fill="currentColor" stroke="none" />}
    </TabIcon>
  ),
  evolution: () => (
    <TabIcon>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </TabIcon>
  ),
  patients: () => (
    <TabIcon>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </TabIcon>
  ),
  alerts: () => (
    <TabIcon>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </TabIcon>
  ),
  more: () => (
    <TabIcon>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </TabIcon>
  ),
} satisfies Record<string, (active: boolean) => React.ReactNode>;

/** Menu inferior fixo, só mobile (lg:hidden), hoje restrito ao papel
 * 'profissional' (puro ou acumulado com coordenação — a flag é decidida em
 * AdminShell, não aqui). Alvos de toque ~48px e padding inferior cobrindo a
 * área segura do aparelho (gesture bar do iPhone/Android). */
export function BottomTabBar({ items }: BottomTabBarProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-admin-sidebar/95 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="flex items-stretch justify-between">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.matchPrefix ?? [item.href]).some(
              (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
            );
          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors",
                  active ? "text-[var(--primary)]" : "text-text-muted active:text-text-secondary",
                )}
              >
                <span className="relative flex h-6 w-6 items-center justify-center">
                  {item.icon(active)}
                  {!!item.badge && item.badge > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white shadow-[0_0_6px_var(--danger)]">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
