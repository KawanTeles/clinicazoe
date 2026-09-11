"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import type { AbsencePeriodFilter } from "@/modules/appointments/services/appointment-queries";

interface Option {
  id: string;
  name: string;
}

const PERIOD_OPTIONS: { value: AbsencePeriodFilter; label: string }[] = [
  { value: "todos", label: "Todo o período" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "mes_atual", label: "Este mês" },
];

export function AbsencesFilters({
  professionals,
  selectedProfessionalId,
  selectedPeriod,
  showProfessionalFilter,
}: {
  professionals: Option[];
  selectedProfessionalId: string;
  selectedPeriod: AbsencePeriodFilter;
  showProfessionalFilter: boolean;
}) {
  const router = useRouter();

  function navigate(next: { professional?: string; period?: AbsencePeriodFilter }) {
    const params = new URLSearchParams();
    const professional = next.professional ?? selectedProfessionalId;
    const period = next.period ?? selectedPeriod;
    if (professional) params.set("professional", professional);
    if (period && period !== "todos") params.set("period", period);
    router.push(`/faltas${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card sm:flex-row sm:items-end">
      <div className="w-full sm:w-56">
        <Select
          label="Período"
          name="period"
          value={selectedPeriod}
          onChange={(e) => navigate({ period: e.target.value as AbsencePeriodFilter })}
        >
          {PERIOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {showProfessionalFilter && (
        <div className="w-full sm:w-64">
          <Select
            label="Profissional"
            name="professional"
            value={selectedProfessionalId}
            onChange={(e) => navigate({ professional: e.target.value })}
          >
            <option value="">Todos os profissionais</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );
}
