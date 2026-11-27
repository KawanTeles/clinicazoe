"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { renderNavIcon } from "@/components/layout/nav-icons";
import { InstallAppCard } from "@/components/layout/InstallAppCard";
import { signOut } from "@/modules/auth/services/auth-client";
import type { NavItem } from "@/lib/navigation";

interface MaisScreenProps {
  fullName: string;
  roleLabel: string;
  avatarUrl: string | null;
  items: NavItem[];
}

function ChevronRight() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function MaisScreen({ fullName, roleLabel, avatarUrl, items }: MaisScreenProps) {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/equipe");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/profile"
        className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-card transition-colors hover:border-primary/50"
      >
        <Avatar src={avatarUrl} name={fullName} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-text-primary">{fullName}</p>
          <p className="text-xs font-semibold text-text-muted">{roleLabel}</p>
        </div>
        <span className="text-text-muted">
          <ChevronRight />
        </span>
      </Link>

      <InstallAppCard />

      <ul className="flex flex-col divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {items.map((item) => (
          <li key={`${item.href}-${item.label}`}>
            <Link href={item.href} className="flex items-center gap-3 px-4 py-3.5 active:bg-card-elevated/60">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card-elevated text-text-secondary">
                {renderNavIcon(item.icon)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">{item.label}</span>
              <span className="text-text-muted">
                <ChevronRight />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={handleSignOut}
        className="flex items-center justify-center gap-2 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3.5 text-sm font-bold text-danger active:bg-danger/15"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Sair da conta
      </button>

      <p className="px-1 text-center text-[11px] leading-relaxed text-text-muted">
        Por segurança, você é desconectada automaticamente após um tempo sem uso. Mantenha o bloqueio de tela
        do seu celular ativado — o app nunca guarda sua senha.
      </p>
    </div>
  );
}
