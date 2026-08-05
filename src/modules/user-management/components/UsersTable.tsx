import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ROLE_LABELS } from "@/lib/navigation";
import type { Role } from "@/lib/supabase/types";
import type { UserListItem } from "@/modules/user-management/services/user-queries";
import { ActionsMenu } from "./ActionsMenu";

const ROLE_BADGE_TONE: Record<Role, "premium" | "success" | "neutral" | "warning"> = {
  admin: "premium",
  recepcionista: "warning",
  profissional: "success",
  paciente: "neutral",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return dateFormatter.format(new Date(iso));
}

export function UsersTable({ users, currentUserId }: { users: UserListItem[]; currentUserId: string }) {
  if (users.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm font-medium text-text-secondary">
        Nenhum usuário encontrado.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-[0_10px_40px_rgba(0,0,0,0.25)]">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b border-border bg-card-elevated/80 text-xs font-bold uppercase tracking-wider text-text-secondary">
          <tr>
            <th className="px-5 py-4 font-bold">Nome</th>
            <th className="px-5 py-4 font-bold">E-mail</th>
            <th className="px-5 py-4 font-bold">Telefone</th>
            <th className="px-5 py-4 font-bold">Tipo</th>
            <th className="px-5 py-4 font-bold">Status</th>
            <th className="px-5 py-4 font-bold">Criado em</th>
            <th className="px-5 py-4 font-bold">Último acesso</th>
            <th className="px-5 py-4 font-bold text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {users.map((user) => (
            <tr key={user.id} className="transition-colors hover:bg-card-elevated/50">
              <td className="px-5 py-4">
                <Link href={`/users/${user.id}`} className="flex items-center gap-3 group">
                  <Avatar src={user.avatarUrl} name={user.full_name || "?"} size={36} />
                  <span className="font-semibold text-text-primary group-hover:text-[var(--link)] transition-colors">
                    {user.full_name || "Sem nome"}
                  </span>
                </Link>
              </td>
              <td className="px-5 py-4 text-text-secondary">{user.email || "—"}</td>
              <td className="px-5 py-4 text-text-secondary">{user.phone || "—"}</td>
              <td className="px-5 py-4">
                <Badge tone={ROLE_BADGE_TONE[user.role]}>{ROLE_LABELS[user.role] ?? user.role}</Badge>
              </td>
              <td className="px-5 py-4">
                <Badge tone={user.status === "active" ? "success" : "neutral"}>
                  {user.status === "active" ? "Ativo" : "Inativo"}
                </Badge>
              </td>
              <td className="px-5 py-4 text-text-secondary">{formatDate(user.created_at)}</td>
              <td className="px-5 py-4 text-text-secondary">{formatDate(user.last_sign_in_at)}</td>
              <td className="px-5 py-4">
                <ActionsMenu
                  userId={user.id}
                  userName={user.full_name || "este usuário"}
                  status={user.status}
                  isSelf={user.id === currentUserId}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
