import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/whatsapp";
import { getFinancialEntries, getFinancialSummary } from "@/modules/financial/services/financial-queries";
import { FinancialTable } from "@/modules/financial/components/FinancialTable";

export const metadata = {
  title: "Financeiro — ClinicaZoe",
};

const ALLOWED_ROLES = ["admin", "profissional"];

export default async function FinancialPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getCurrentUser();
  if (!session || !ALLOWED_ROLES.includes(session.profile.role)) redirect("/dashboard");

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [{ items, totalPages }, summary] = await Promise.all([
    getFinancialEntries(session.profile.role, session.user.id, page),
    getFinancialSummary(session.profile.role, session.user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Financeiro</h1>
        <p className="text-sm text-text-secondary">
          Lançamentos gerados automaticamente na confirmação de cada consulta.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Em aberto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-text-primary">
              {formatCurrency(summary.emAberto)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recebido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-text-primary">{formatCurrency(summary.pago)}</p>
          </CardContent>
        </Card>
      </div>

      <FinancialTable entries={items} />
      <Pagination page={page} totalPages={totalPages} basePath="/financial" />
    </div>
  );
}
