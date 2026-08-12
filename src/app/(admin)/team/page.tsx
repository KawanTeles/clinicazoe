import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/navigation";
import { getTeamMembers } from "@/modules/team/services/team-queries";
import { TeamTable } from "@/modules/team/components/TeamTable";

export const metadata = {
  title: "Equipe — Espaço Zoe",
};

const FILTER_ROLES = ["admin", "recepcionista", "profissional"] as const;
const PAGE_SIZE = 20;

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; page?: string }>;
}) {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "admin") redirect("/dashboard");

  const { q, role, page: pageParam } = await searchParams;
  const members = await getTeamMembers();

  const filtered = members.filter((member) => {
    const matchesRole = !role || member.role === role;
    const matchesQuery =
      !q || member.full_name.toLowerCase().includes(q.toLowerCase());
    return matchesRole && matchesQuery;
  });

  const page = Math.max(1, Number(pageParam) || 1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Equipe</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Administradores, recepcionistas e profissionais da clínica.
          </p>
        </div>
        <Link href="/team/new">
          <Button>Novo membro</Button>
        </Link>
      </div>

      <form className="flex flex-wrap gap-3" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nome..."
          className="h-11 w-full max-w-xs rounded-xl border border-border bg-card-elevated px-4 text-sm text-text-primary placeholder:text-text-muted transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <select
          name="role"
          defaultValue={role ?? ""}
          className="h-11 rounded-xl border border-border bg-card-elevated px-4 text-sm text-text-primary transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 [&>option]:bg-card-elevated [&>option]:text-text-primary"
        >
          <option value="">Todos os cargos</option>
          {FILTER_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <TeamTable members={pageItems} />
      <Pagination page={page} totalPages={totalPages} basePath="/team" searchParams={{ q, role }} />
    </div>
  );
}

