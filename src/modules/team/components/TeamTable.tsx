import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ROLE_LABELS } from "@/lib/navigation";
import type { Database } from "@/lib/supabase/types";
import { DeleteMemberButton } from "./DeleteMemberButton";

type Profile = Database["public"]["Tables"]["profiles"]["Row"] & { avatarUrl: string | null };

export function TeamTable({ members }: { members: Profile[] }) {
  if (members.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-text-secondary">
        Nenhum membro encontrado.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-border text-xs uppercase tracking-wide text-text-secondary">
          <tr>
            <th className="px-4 py-3 font-medium">Nome</th>
            <th className="px-4 py-3 font-medium">Cargo</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Telefone</th>
            <th className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {members.map((member) => (
            <tr key={member.id}>
              <td className="px-4 py-3">
                <Link href={`/team/${member.id}`} className="flex items-center gap-3">
                  <Avatar src={member.avatarUrl} name={member.full_name || "?"} size={32} />
                  <span className="font-medium text-text-primary">
                    {member.full_name || "Sem nome"}
                  </span>
                </Link>
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {ROLE_LABELS[member.role] ?? member.role}
              </td>
              <td className="px-4 py-3">
                <Badge tone={member.status === "active" ? "success" : "neutral"}>
                  {member.status === "active" ? "Ativo" : "Inativo"}
                </Badge>
              </td>
              <td className="px-4 py-3 text-text-secondary">{member.phone || "—"}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/team/${member.id}`}
                    className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-sm font-medium text-text-primary hover:bg-bg-soft"
                  >
                    Editar
                  </Link>
                  <DeleteMemberButton id={member.id} name={member.full_name || "este usuário"} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
