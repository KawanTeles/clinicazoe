import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/navigation";
import { getAllUsers } from "@/modules/user-management/services/user-queries";
import { UsersTable } from "@/modules/user-management/components/UsersTable";

export const metadata = {
  title: "Usuários — ClinicaZoe",
};

const FILTER_ROLES = ["admin", "recepcionista", "profissional", "paciente"] as const;
const PAGE_SIZE = 20;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string }>;
}) {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "admin") redirect("/dashboard");

  const { q, role, status, page: pageParam } = await searchParams;
  const users = await getAllUsers();

  const search = q?.trim().toLowerCase();
  const filtered = users.filter((user) => {
    const matchesRole = !role || user.role === role;
    const matchesStatus = !status || user.status === status;
    const matchesQuery =
      !search ||
      user.full_name.toLowerCase().includes(search) ||
      user.email.toLowerCase().includes(search) ||
      (user.phone ?? "").toLowerCase().includes(search);
    return matchesRole && matchesStatus && matchesQuery;
  });

  const page = Math.max(1, Number(pageParam) || 1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Usuários</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Gerencie todas as contas do sistema: clientes, recepção, profissionais e administradores.
          </p>
        </div>
      </div>

      <form className="flex flex-wrap gap-3" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nome, e-mail ou telefone..."
          className="h-11 w-full max-w-xs rounded-xl border border-border bg-card-elevated px-4 text-sm text-text-primary placeholder:text-text-muted transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <select
          name="role"
          defaultValue={role ?? ""}
          className="h-11 rounded-xl border border-border bg-card-elevated px-4 text-sm text-text-primary transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 [&>option]:bg-card-elevated [&>option]:text-text-primary"
        >
          <option value="">Todos os tipos</option>
          {FILTER_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-11 rounded-xl border border-border bg-card-elevated px-4 text-sm text-text-primary transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 [&>option]:bg-card-elevated [&>option]:text-text-primary"
        >
          <option value="">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
        </select>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <UsersTable users={pageItems} currentUserId={session.user.id} />
      <Pagination page={page} totalPages={totalPages} basePath="/users" searchParams={{ q, role, status }} />
    </div>
  );
}
