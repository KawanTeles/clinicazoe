"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { AIDisclaimerNotice } from "./AIDisclaimerNotice";
import {
  generateAIReport,
  listEvolutionsForReport,
  searchPatientsForReport,
  type EvolutionOption,
} from "@/modules/ai/services/reports-actions";
import { REPORT_TEMPLATE_LABELS, type ReportTemplate } from "@/modules/ai/services/provider-types";
import type { PatientOption } from "@/modules/patients/services/patient-queries";

const TEMPLATES = Object.keys(REPORT_TEMPLATE_LABELS) as ReportTemplate[];

export function ReportWizard() {
  const router = useRouter();

  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<PatientOption[]>([]);
  const [patientOpen, setPatientOpen] = useState(false);
  const [patient, setPatient] = useState<PatientOption | null>(null);
  const patientBoxRef = useRef<HTMLDivElement>(null);

  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  const [evolutions, setEvolutions] = useState<EvolutionOption[]>([]);
  const [selectedEvolutionIds, setSelectedEvolutionIds] = useState<string[]>([]);
  const [loadingEvolutions, setLoadingEvolutions] = useState(false);

  const [template, setTemplate] = useState<ReportTemplate>("clinico");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientOpen) return;
    const timeout = setTimeout(async () => {
      const results = await searchPatientsForReport(patientQuery);
      setPatientResults(results);
    }, 200);
    return () => clearTimeout(timeout);
  }, [patientQuery, patientOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (patientBoxRef.current && !patientBoxRef.current.contains(event.target as Node)) setPatientOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!patient) return;
    setLoadingEvolutions(true);
    listEvolutionsForReport(patient.id, periodStart, periodEnd)
      .then((items) => {
        setEvolutions(items);
        setSelectedEvolutionIds(items.map((e) => e.id));
      })
      .finally(() => setLoadingEvolutions(false));
  }, [patient, periodStart, periodEnd]);

  function toggleEvolution(id: string) {
    setSelectedEvolutionIds((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  }

  async function handleGenerate() {
    if (!patient) {
      setError("Selecione um paciente.");
      return;
    }
    if (selectedEvolutionIds.length === 0) {
      setError("Selecione ao menos uma evolução.");
      return;
    }
    setError(null);
    setGenerating(true);
    const result = await generateAIReport({
      patientId: patient.id,
      template,
      periodStart,
      periodEnd,
      evolutionIds: selectedEvolutionIds,
    });
    setGenerating(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push(`/reports/${result.reportId}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <AIDisclaimerNotice />

      <div className="flex flex-col gap-1.5" ref={patientBoxRef}>
        <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">1. Paciente</label>
        {patient ? (
          <div className="flex items-center justify-between rounded-xl border border-primary/40 bg-card-elevated px-3.5 py-2.5">
            <div>
              <p className="text-sm font-bold text-text-primary">{patient.fullName}</p>
              {patient.phone && <p className="text-xs text-text-secondary">{patient.phone}</p>}
            </div>
            <button
              type="button"
              onClick={() => {
                setPatient(null);
                setEvolutions([]);
                setSelectedEvolutionIds([]);
              }}
              className="text-xs font-bold text-[var(--primary)] hover:underline"
            >
              Trocar
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              placeholder="Buscar paciente por nome..."
              value={patientQuery}
              onChange={(e) => setPatientQuery(e.target.value)}
              onFocus={() => setPatientOpen(true)}
              className="h-10 w-full rounded-xl border border-border bg-card-elevated px-3.5 text-xs font-medium text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {patientOpen && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-card-hover">
                {patientResults.length === 0 ? (
                  <div className="px-3.5 py-3 text-xs text-text-muted">Nenhum paciente encontrado.</div>
                ) : (
                  patientResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPatient(p);
                        setPatientOpen(false);
                        setPatientQuery("");
                      }}
                      className="block w-full px-3.5 py-2.5 text-left text-xs font-medium text-text-primary hover:bg-surface/60"
                    >
                      {p.fullName}
                      {p.phone && <span className="ml-2 text-text-secondary">{p.phone}</span>}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="2. Período — de (opcional)" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        <Input label="Período — até (opcional)" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">3. Evoluções a utilizar</label>
        {!patient ? (
          <p className="text-xs text-text-muted">Selecione um paciente para ver as evoluções disponíveis.</p>
        ) : loadingEvolutions ? (
          <p className="text-xs text-text-muted">Carregando evoluções...</p>
        ) : evolutions.length === 0 ? (
          <p className="text-xs text-text-muted">Nenhuma evolução encontrada nesse período.</p>
        ) : (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-card-elevated/40 p-3">
            {evolutions.map((e) => (
              <label key={e.id} className="flex cursor-pointer items-start gap-2 text-xs text-text-secondary hover:text-text-primary">
                <input
                  type="checkbox"
                  checked={selectedEvolutionIds.includes(e.id)}
                  onChange={() => toggleEvolution(e.id)}
                  className="mt-0.5 h-3.5 w-3.5 rounded accent-primary"
                />
                <span>
                  <span className="font-bold text-text-primary">
                    {e.date ? new Date(`${e.date}T00:00:00`).toLocaleDateString("pt-BR") : "Sem data"}
                  </span>{" "}
                  — {e.preview}
                  {e.preview.length >= 140 ? "..." : ""}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <Select label="4. Modelo de relatório" value={template} onChange={(e) => setTemplate(e.target.value as ReportTemplate)}>
        {TEMPLATES.map((id) => (
          <option key={id} value={id}>
            {REPORT_TEMPLATE_LABELS[id]}
          </option>
        ))}
      </Select>

      {error && <p className="text-xs font-semibold text-danger">{error}</p>}

      <div className="flex justify-end">
        <Button type="button" isLoading={generating} onClick={handleGenerate}>
          ✨ Gerar Relatório IA
        </Button>
      </div>
    </div>
  );
}
