import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getFinancialCategories } from "@/modules/financial/services/financial-category-queries";
import { FinancialCategoryManager } from "@/modules/financial/components/FinancialCategoryManager";

export const metadata = {
  title: "Categorias Financeiras — Espaço Zoe",
};

export default async function FinancialCategoriesPage() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "admin") redirect("/dashboard");

  const categories = await getFinancialCategories();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Categorias Financeiras</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Categorias de receita e despesa usadas nos lançamentos manuais do financeiro.
        </p>
      </div>

      <FinancialCategoryManager categories={categories} />
    </div>
  );
}
