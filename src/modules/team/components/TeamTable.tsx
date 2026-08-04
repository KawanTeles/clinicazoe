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
      <div className="rounded-2xl border border-dashed border-[#255044] bg-[#102A22] p-12 text-center text-sm font-medium text-[#C8D4CF]">
        Nenhum membro encontrado.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#255044] bg-[#102A22] shadow-[0_10px_40px_rgba(0,0,0,0.25)]">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-[#255044] bg-[#17382D]/80 text-xs font-bold uppercase tracking-wider text-[#C8D4CF]">
          <tr>
            <th className="px-5 py-4 font-bold">Nome</th>
            <th className="px-5 py-4 font-bold">Cargo</th>
            <th className="px-5 py-4 font-bold">Status</th>
            <th className="px-5 py-4 font-bold">Telefone</th>
            <th className="px-5 py-4 font-bold text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#255044]/40">
          {members.map((member) => (
            <tr key={member.id} className="transition-colors hover:bg-[#17382D]/50">
              <td className="px-5 py-4">
                <Link href={`/team/${member.id}`} className="flex items-center gap-3 group">
                  <Avatar src={member.avatarUrl} name={member.full_name || "?"} size={36} />
                  <span className="font-semibold text-[#F5F7F6] group-hover:text-[#5ED39D] transition-colors">
                    {member.full_name || "Sem nome"}
                  </span>
                </Link>
              </td>
              <td className="px-5 py-4 font-medium text-[#C8D4CF]">
                {ROLE_LABELS[member.role] ?? member.role}
              </td>
              <td className="px-5 py-4">
                <Badge tone={member.status === "active" ? "success" : "neutral"}>
                  {member.status === "active" ? "Ativo" : "Inativo"}
                </Badge>
              </td>
              <td className="px-5 py-4 text-[#C8D4CF]">{member.phone || "—"}</td>
              <td className="px-5 py-4">
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/team/${member.id}`}
                    className="inline-flex h-9 items-center rounded-xl border border-[#255044] bg-[#17382D] px-3.5 text-xs font-semibold text-[#F5F7F6] transition-all hover:border-[#2E8B57]/50 hover:bg-[#102A22]"
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

