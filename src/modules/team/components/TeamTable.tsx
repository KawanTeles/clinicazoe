import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ROLE_LABELS } from "@/lib/navigation";
import type { Database } from "@/lib/supabase/types";
import { DeleteMemberButton } from "./DeleteMemberButton";
import { ToggleMemberStatusButton } from "./ToggleMemberStatusButton";

type Profile = Database["public"]["Tables"]["profiles"]["Row"] & { avatarUrl: string | null };

export function TeamTable({ members, currentUserId }: { members: Profile[]; currentUserId: string }) {
  if (members.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm font-medium text-text-secondary">
        Nenhum membro encontrado.
      </div>
    );
  }

  return (
    <>
      {/* Cards — mobile/tablet */}
      <ul className="flex flex-col gap-2.5 sm:hidden">
        {members.map((member) => (
          <li key={member.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <Link href={`/team/${member.id}`} className="flex items-center gap-3">
              <Avatar src={member.avatarUrl} name={member.full_name || "?"} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-text-primary">{member.full_name || "Sem nome"}</p>
                <p className="truncate text-xs text-text-secondary">{ROLE_LABELS[member.role] ?? member.role}</p>
                <p className="truncate text-xs text-text-muted">{member.phone || "Sem telefone"}</p>
              </div>
              <Badge tone={member.status === "active" ? "success" : "neutral"} className="shrink-0 text-[10px]">
                {member.status === "active" ? "Ativo" : "Inativo"}
              </Badge>
            </Link>
            <div className="mt-3 flex items-center justify-end gap-2 border-t border-border/60 pt-3">
              <Link
                href={`/team/${member.id}`}
                className="inline-flex h-9 items-center rounded-xl border border-border bg-card-elevated px-3.5 text-xs font-semibold text-text-primary"
              >
                Editar
              </Link>
              <ToggleMemberStatusButton
                id={member.id}
                name={member.full_name || "este usuário"}
                status={member.status}
                isSelf={member.id === currentUserId}
              />
              <DeleteMemberButton id={member.id} name={member.full_name || "este usuário"} />
            </div>
          </li>
        ))}
      </ul>

      {/* Tabela — desktop */}
      <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card shadow-[0_10px_40px_rgba(0,0,0,0.25)] sm:block">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-border bg-card-elevated/80 text-xs font-bold uppercase tracking-wider text-text-secondary">
          <tr>
            <th className="px-5 py-4 font-bold">Nome</th>
            <th className="px-5 py-4 font-bold">Cargo</th>
            <th className="px-5 py-4 font-bold">Status</th>
            <th className="px-5 py-4 font-bold">Telefone</th>
            <th className="px-5 py-4 font-bold text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {members.map((member) => (
            <tr key={member.id} className="transition-colors hover:bg-card-elevated/50">
              <td className="px-5 py-4">
                <Link href={`/team/${member.id}`} className="flex items-center gap-3 group">
                  <Avatar src={member.avatarUrl} name={member.full_name || "?"} size={36} />
                  <span className="font-semibold text-text-primary group-hover:text-[var(--link)] transition-colors">
                    {member.full_name || "Sem nome"}
                  </span>
                </Link>
              </td>
              <td className="px-5 py-4 font-medium text-text-secondary">
                {ROLE_LABELS[member.role] ?? member.role}
              </td>
              <td className="px-5 py-4">
                <Badge tone={member.status === "active" ? "success" : "neutral"}>
                  {member.status === "active" ? "Ativo" : "Inativo"}
                </Badge>
              </td>
              <td className="px-5 py-4 text-text-secondary">{member.phone || "—"}</td>
              <td className="px-5 py-4">
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/team/${member.id}`}
                    className="inline-flex h-9 items-center rounded-xl border border-border bg-card-elevated px-3.5 text-xs font-semibold text-text-primary transition-all hover:border-primary/50 hover:bg-card"
                  >
                    Editar
                  </Link>
                  <ToggleMemberStatusButton
                    id={member.id}
                    name={member.full_name || "este usuário"}
                    status={member.status}
                    isSelf={member.id === currentUserId}
                  />
                  <DeleteMemberButton id={member.id} name={member.full_name || "este usuário"} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}
