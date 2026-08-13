import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/whatsapp";
import { getFinancialEntries, getFinancialSummary } from "@/modules/financial/services/financial-queries";
import { FinancialTable } from "@/modules/financial/components/FinancialTable";
import { getActiveFinancialCategories } from "@/modules/financial/services/financial-category-queries";
import {
  getActiveProfessionalsForSelect,
  getFinancialTransactions,
} from "@/modules/financial/services/financial-transaction-queries";
import { FinancialTransactionsSection } from "@/modules/financial/components/FinancialTransactionsSection";
import type { FinancialCategoryOption } from "@/modules/financial/components/FinancialTransactionForm";

export const metadata = {
  title: "Financeiro — Espaço Zoe",
};

const ALLOWED_ROLES = ["admin", "profissional", "recepcionista"];
const FINANCIAL_STAFF_ROLES = ["admin", "recepcionista"];

export default async function FinancialPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getCurrentUser();
  if (!session || !ALLOWED_ROLES.includes(session.profile.role)) redirect("/dashboard");

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const isFinancialStaff = FINANCIAL_STAFF_ROLES.includes(session.profile.role);

  const [{ items, totalPages }, summary, transactionsData, expenseCategories, revenueCategories, professionals] =
    await Promise.all([
      getFinancialEntries(session.profile.role, session.user.id, page),
      getFinancialSummary(session.profile.role, session.user.id),
      isFinancialStaff ? getFinancialTransactions({ page: 1 }) : Promise.resolve({ items: [], totalPages: 1 }),
      isFinancialStaff ? getActiveFinancialCategories("despesa") : Promise.resolve([]),
      isFinancialStaff ? getActiveFinancialCategories("receita") : Promise.resolve([]),
      isFinancialStaff ? getActiveProfessionalsForSelect() : Promise.resolve([]),
    ]);

  const categories: FinancialCategoryOption[] = [
    ...expenseCategories.map((c) => ({ ...c, kind: "despesa" as const })),
    ...revenueCategories.map((c) => ({ ...c, kind: "receita" as const })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">Financeiro</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Lançamentos gerados automaticamente na confirmação de cada atendimento.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-amber-500 to-emerald-400" />
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-wider text-text-secondary font-heading">Em Aberto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-extrabold text-text-primary font-heading">
              {formatCurrency(summary.emAberto)}
            </p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-primary-dark to-primary" />
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-wider text-text-secondary font-heading">Recebido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-extrabold text-text-primary font-heading">{formatCurrency(summary.pago)}</p>
          </CardContent>
        </Card>
      </div>

      <FinancialTable entries={items} />
      <Pagination page={page} totalPages={totalPages} basePath="/financial" />

      {isFinancialStaff && (
        <FinancialTransactionsSection
          initialItems={transactionsData.items}
          initialTotalPages={transactionsData.totalPages}
          categories={categories}
          professionals={professionals}
        />
      )}
    </div>
  );
}

