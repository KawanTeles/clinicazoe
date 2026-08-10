"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EvolutionTimeline } from "@/modules/evolutions/components/EvolutionTimeline";
import { PatientAIAssistant } from "@/modules/ai/components/PatientAIAssistant";
import type { EvolutionView } from "@/modules/evolutions/services/evolution-queries";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

interface MyPatientDetailTabsProps {
  patient: {
    id: string;
    fullName: string;
    phone: string | null;
    status: string;
    details: {
      email?: string | null;
      whatsapp?: string | null;
      city?: string | null;
      birth_date?: string | null;
    } | null;
  };
  evolutions: EvolutionView[];
  evolutionsTotalPages: number;
  aiAssistantEnabled: boolean;
}

const BASE_TABS = ["Dados", "Histórico Clínico"] as const;
const AI_TAB = "🤖 Assistente IA";
type Tab = (typeof BASE_TABS)[number] | typeof AI_TAB;

export function MyPatientDetailTabs({
  patient,
  evolutions,
  evolutionsTotalPages,
  aiAssistantEnabled,
}: MyPatientDetailTabsProps) {
  const [tab, setTab] = useState<Tab>("Dados");
  const visibleTabs: Tab[] = aiAssistantEnabled ? [...BASE_TABS, AI_TAB] : [...BASE_TABS];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">{patient.fullName}</h1>
        <div className="mt-1 flex items-center gap-2">
          <Badge tone={patient.status === "active" ? "success" : "neutral"}>
            {patient.status === "active" ? "Ativo" : "Inativo"}
          </Badge>
          <span className="text-sm text-text-secondary">{patient.phone || "Sem telefone"}</span>
        </div>
      </div>

      {visibleTabs.length > 1 && (
        <div className="flex flex-wrap gap-2 border-b border-border pb-2">
          {visibleTabs.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={
                tab === item
                  ? "rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-white"
                  : "rounded-full border border-border bg-card-elevated px-4 py-1.5 text-xs font-semibold text-text-secondary hover:border-primary/50"
              }
            >
              {item}
            </button>
          ))}
        </div>
      )}

      {tab === "Dados" && (
        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-text-secondary">Dados</h2>
          <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-6 shadow-card sm:grid-cols-2">
            <Field label="Telefone" value={patient.phone} />
            <Field label="E-mail" value={patient.details?.email} />
            <Field label="WhatsApp" value={patient.details?.whatsapp} />
            <Field label="Cidade" value={patient.details?.city} />
            <Field
              label="Data de nascimento"
              value={
                patient.details?.birth_date
                  ? dateFormatter.format(new Date(`${patient.details.birth_date}T00:00:00`))
                  : null
              }
            />
          </div>
        </div>
      )}

      {tab === "Histórico Clínico" && (
        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-text-secondary">Histórico Clínico</h2>
          <EvolutionTimeline
            patientId={patient.id}
            initialEvolutions={evolutions}
            initialTotalPages={evolutionsTotalPages}
          />
        </div>
      )}

      {tab === AI_TAB && <PatientAIAssistant patientId={patient.id} />}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">{label}</p>
      <p className="mt-1 text-sm text-text-primary">{value || "—"}</p>
    </div>
  );
}
