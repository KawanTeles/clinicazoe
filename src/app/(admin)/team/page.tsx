import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/navigation";
import { getTeamMembers } from "@/modules/team/services/team-queries";
import { TeamTable } from "@/modules/team/components/TeamTable";

export const metadata = {
  title: "Equipe — ClinicaZoe",
};

const FILTER_ROLES = ["admin", "recepcionista", "profissional"] as const;

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "admin") redirect("/dashboard");

  const { q, role } = await searchParams;
  const members = await getTeamMembers();

  const filtered = members.filter((member) => {
    const matchesRole = !role || member.role === role;
    const matchesQuery =
      !q || member.full_name.toLowerCase().includes(q.toLowerCase());
    return matchesRole && matchesQuery;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Equipe</h1>
          <p className="text-sm text-text-secondary">
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
          className="h-10 w-full max-w-xs rounded-lg border border-border bg-white px-3 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-accent"
        />
        <select
          name="role"
          defaultValue={role ?? ""}
          className="h-10 rounded-lg border border-border bg-white px-3 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-accent"
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

      <TeamTable members={filtered} />
    </div>
  );
}
