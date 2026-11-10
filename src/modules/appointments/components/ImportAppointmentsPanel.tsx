"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { formatCurrency } from "@/lib/whatsapp";
import { MODALITY_LABELS, PARTICULAR_PRODUCT_LABELS, insuranceRequiresModality } from "@/lib/constants";
import type { AppointmentStatus, Modality, ParticularProduct, PaymentMethod } from "@/lib/supabase/types";
import { PatientPickerField } from "@/modules/patients/components/PatientPickerField";
import type { PatientSearchResult } from "@/modules/patients/services/patient-actions";
import { getEffectiveDuration, getProfessionalPricing, type ProfessionalPricingResult } from "@/modules/appointments/services/booking-queries";
import {
  createImportedAppointmentFromIds,
  previewImportRows,
  confirmImportBatch,
  undoImportBatch,
  type ImportRowInput,
  type ValidatedImportRow,
  type ImportBatchView,
} from "@/modules/appointments/services/import-actions";
import { parseCsv } from "@/lib/csv";

interface Option {
  id: string;
  name: string;
}

interface ProfessionalOption {
  id: string;
  fullName: string;
}

const MODALITIES: Modality[] = ["aba", "comum"];
const PARTICULAR_PRODUCTS: ParticularProduct[] = ["consulta", "pacote"];
const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cartao: "Cartão",
  pix: "PIX",
  dinheiro: "Dinheiro",
  convenio: "Convênio",
};
const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pendente: "Pendente",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  remarcada: "Remarcada",
  concluida: "Concluída",
  faltou: "Faltou",
  recusada: "Recusada",
  faltou_justificada: "Falta justificada",
};
const LAUNCH_STATUSES: AppointmentStatus[] = ["confirmada", "concluida", "faltou", "faltou_justificada", "cancelada"];

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function ImportAppointmentsPanel({
  insurances,
  professionals,
  isAdmin,
  initialBatches,
}: {
  insurances: Option[];
  professionals: ProfessionalOption[];
  isAdmin: boolean;
  initialBatches: ImportBatchView[];
}) {
  const [tab, setTab] = useState<"avulso" | "planilha" | "lotes">("avulso");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {([
          ["avulso", "Lançamento avulso"],
          ["planilha", "Importar planilha"],
          ["lotes", "Lotes importados"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${
              tab === key ? "bg-primary text-white shadow-button" : "text-text-secondary hover:bg-card-elevated"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "avulso" && <AvulsoForm insurances={insurances} professionals={professionals} />}
      {tab === "planilha" && <SpreadsheetImport insurances={insurances} />}
      {tab === "lotes" && <BatchHistory isAdmin={isAdmin} initialBatches={initialBatches} />}
    </div>
  );
}

function AvulsoForm({ insurances, professionals }: { insurances: Option[]; professionals: ProfessionalOption[] }) {
  const router = useRouter();
  const [patient, setPatient] = useState<PatientSearchResult | null>(null);
  const [professionalId, setProfessionalId] = useState("");
  const [insuranceId, setInsuranceId] = useState("");
  const [pricing, setPricing] = useState<ProfessionalPricingResult | null>(null);
  const [modality, setModality] = useState<Modality | "">("");
  const [particularProduct, setParticularProduct] = useState<ParticularProduct | "">("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [value, setValue] = useState("");
  const [paid, setPaid] = useState(false);
  const [status, setStatus] = useState<AppointmentStatus>("confirmada");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const insurance = insurances.find((i) => i.id === insuranceId) ?? null;
  const professional = professionals.find((p) => p.id === professionalId) ?? null;
  const requiresModality = insuranceRequiresModality(insurance?.name);

  useEffect(() => {
    if (date) {
      const today = new Date().toISOString().slice(0, 10);
      setStatus(date < today ? "concluida" : "confirmada");
    }
  }, [date]);

  useEffect(() => {
    setModality("");
    setParticularProduct("");
    setPricing(null);
    setValue("");
    if (!professionalId || !insuranceId) return;
    getProfessionalPricing(professionalId, insuranceId).then(setPricing);
  }, [professionalId, insuranceId]);

  useEffect(() => {
    if (!pricing) return;
    const match =
      pricing.insuranceKind === "convenio"
        ? pricing.options.find((o) => o.modality === modality)
        : pricing.options.find((o) => o.product === particularProduct);
    if (match) setValue(String(match.value));
  }, [pricing, modality, particularProduct]);

  async function handleSubmit() {
    setError(null);
    if (!patient) return setError("Selecione o paciente.");
    if (!professional) return setError("Selecione o profissional.");
    if (!insurance) return setError("Selecione o convênio.");
    if (requiresModality && !modality) return setError("Selecione a modalidade.");
    if (!requiresModality && !particularProduct) return setError("Selecione o produto particular.");
    if (!date) return setError("Informe a data.");
    if (!time) return setError("Informe a hora.");
    if (!paymentMethod) return setError("Selecione a forma de pagamento.");

    setSaving(true);
    const result = await createImportedAppointmentFromIds({
      patientId: patient.id,
      professionalId: professional.id,
      professionalName: professional.fullName,
      insuranceId: insurance.id,
      insuranceName: insurance.name,
      date,
      startTime: time,
      durationMinutes: duration ? Number(duration) : null,
      modality: requiresModality ? (modality as Modality) : null,
      particularProduct: !requiresModality ? (particularProduct as ParticularProduct) : null,
      paymentMethod,
      value: value.trim() ? Number(value.replace(",", ".")) : null,
      paid,
      status,
      notes: notes.trim() || null,
    });
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  if (success) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-sm font-bold text-text-primary">Atendimento lançado com sucesso.</p>
          <p className="text-xs text-text-secondary">Confirmado direto na agenda, sem notificação ao paciente.</p>
          <Button size="sm" onClick={() => setSuccess(false)}>
            Lançar outro
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-text-secondary">Paciente</label>
          <PatientPickerField
            onSelect={setPatient}
            onClear={() => setPatient(null)}
            selectedName={patient?.fullName}
            selectedPhone={patient?.phone}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Profissional" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
            <option value="">Selecione…</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </Select>
          <Select label="Convênio" value={insuranceId} onChange={(e) => setInsuranceId(e.target.value)}>
            <option value="">Selecione…</option>
            {insurances.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
        </div>

        {insurance && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {requiresModality ? (
              <Select label="Modalidade" value={modality} onChange={(e) => setModality(e.target.value as Modality)}>
                <option value="">Selecione…</option>
                {MODALITIES.map((m) => (
                  <option key={m} value={m}>
                    {MODALITY_LABELS[m]}
                  </option>
                ))}
              </Select>
            ) : (
              <Select
                label="Produto particular"
                value={particularProduct}
                onChange={(e) => setParticularProduct(e.target.value as ParticularProduct)}
              >
                <option value="">Selecione…</option>
                {PARTICULAR_PRODUCTS.map((p) => (
                  <option key={p} value={p}>
                    {PARTICULAR_PRODUCT_LABELS[p]}
                  </option>
                ))}
              </Select>
            )}
            <Select
              label="Forma de pagamento"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            >
              <option value="">Selecione…</option>
              {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((pm) => (
                <option key={pm} value={pm}>
                  {PAYMENT_LABELS[pm]}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Hora" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          <Input
            label="Duração (min, opcional)"
            type="number"
            min={5}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="padrão do horário"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Valor (opcional — vazio = pendente)"
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0,00"
          />
          <Select label="Desfecho" value={status} onChange={(e) => setStatus(e.target.value as AppointmentStatus)}>
            {LAUNCH_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>

        {value.trim() && (
          <Switch label="Esse valor já foi recebido (marcar como pago)" checked={paid} onChange={setPaid} />
        )}

        <Textarea label="Observações (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />

        {error && <p className="text-xs font-semibold text-danger">{error}</p>}

        <div className="flex justify-end">
          <Button isLoading={saving} onClick={handleSubmit}>
            Lançar atendimento
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SpreadsheetImport({ insurances }: { insurances: Option[] }) {
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [rows, setRows] = useState<ValidatedImportRow[] | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ successCount: number; failures: { rowNumber: number; error: string }[] } | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    setFileName(file.name);
    setLabel(file.name.replace(/\.csv$/i, ""));
    const text = await file.text();
    const { headers, rows: parsedRows } = parseCsv(text);

    const required = ["telefone_paciente", "profissional", "data", "hora"];
    const missing = required.filter((col) => !headers.includes(col));
    if (missing.length > 0) {
      setError(`Colunas obrigatórias faltando no CSV: ${missing.join(", ")}.`);
      return;
    }

    const rawRows: ImportRowInput[] = parsedRows.map((row, index) => ({
      rowNumber: index + 2,
      telefone_paciente: row.telefone_paciente,
      profissional: row.profissional,
      data: row.data,
      hora: row.hora,
      duracao_minutos: row.duracao_minutos,
      convenio: row.convenio,
      modalidade: row.modalidade,
      produto_particular: row.produto_particular,
      forma_pagamento: row.forma_pagamento,
      valor: row.valor,
      pago: row.pago,
      status: row.status,
      observacoes: row.observacoes,
    }));

    setLoadingPreview(true);
    const preview = await previewImportRows(rawRows);
    setLoadingPreview(false);

    if (preview.error) {
      setError(preview.error);
      return;
    }
    setRows(preview.rows);
    setExcluded(new Set(preview.rows.filter((r) => !r.ok).map((r) => r.rowNumber)));
  }

  async function handleConfirm() {
    if (!rows) return;
    const toImport = rows.filter((r) => r.ok && !excluded.has(r.rowNumber));
    if (toImport.length === 0) {
      setError("Nenhuma linha válida selecionada pra importar.");
      return;
    }
    setConfirming(true);
    setError(null);
    const res = await confirmImportBatch(toImport, label);
    setConfirming(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setResult({ successCount: res.successCount, failures: res.failures });
    setRows(null);
    router.refresh();
  }

  if (result) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 p-6">
          <p className="text-sm font-bold text-text-primary">
            {result.successCount} atendimento(s) lançado(s) com sucesso.
          </p>
          {result.failures.length > 0 && (
            <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-xs text-danger">
              <p className="font-bold">{result.failures.length} linha(s) falharam na confirmação:</p>
              <ul className="mt-1 list-disc pl-4">
                {result.failures.map((f) => (
                  <li key={f.rowNumber}>Linha {f.rowNumber}: {f.error}</li>
                ))}
              </ul>
            </div>
          )}
          <Button
            size="sm"
            onClick={() => {
              setResult(null);
              setFileName(null);
            }}
          >
            Importar outra planilha
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!rows) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="rounded-lg border border-border/80 bg-card-elevated/40 p-4 text-xs text-text-secondary">
            <p className="font-bold text-text-primary">Colunas esperadas no CSV (cabeçalho na primeira linha):</p>
            <p className="mt-1">
              <code>telefone_paciente</code>, <code>profissional</code>, <code>data</code> (DD/MM/AAAA),{" "}
              <code>hora</code> (HH:MM) — obrigatórias.
            </p>
            <p className="mt-1">
              <code>duracao_minutos</code>, <code>convenio</code> (vazio = {insurances.find((i) => i.name === "Particular")?.name ?? "Particular"}),{" "}
              <code>modalidade</code> (aba/comum), <code>produto_particular</code> (consulta/pacote),{" "}
              <code>forma_pagamento</code>, <code>valor</code>, <code>pago</code> (sim/nao),{" "}
              <code>status</code> (confirmada/concluida/faltou/faltou_justificada/cancelada), <code>observacoes</code> —
              opcionais.
            </p>
          </div>

          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
            className="text-xs text-text-secondary"
          />

          {loadingPreview && <p className="text-xs text-text-muted animate-pulse">Validando linhas…</p>}
          {error && <p className="text-xs font-semibold text-danger">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  const validCount = rows.filter((r) => r.ok && !excluded.has(r.rowNumber)).length;
  const errorCount = rows.filter((r) => !r.ok).length;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-text-primary">{fileName}</p>
            <p className="text-xs text-text-secondary">
              {rows.length} linha(s) · {validCount} prontas pra importar · {errorCount} com erro
            </p>
          </div>
          <Input label="Nome do lote" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>

        <div className="max-h-[480px] overflow-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card-elevated">
              <tr>
                <th className="px-3 py-2 text-left">Linha</th>
                <th className="px-3 py-2 text-left">Paciente</th>
                <th className="px-3 py-2 text-left">Profissional</th>
                <th className="px-3 py-2 text-left">Data/Hora</th>
                <th className="px-3 py-2 text-left">Valor</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.rowNumber} className={`border-t border-border/60 ${!row.ok ? "bg-danger/5" : ""}`}>
                  <td className="px-3 py-2 align-top">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={row.ok && !excluded.has(row.rowNumber)}
                        disabled={!row.ok}
                        onChange={(e) => {
                          const next = new Set(excluded);
                          if (e.target.checked) next.delete(row.rowNumber);
                          else next.add(row.rowNumber);
                          setExcluded(next);
                        }}
                      />
                      {row.rowNumber}
                    </label>
                  </td>
                  {row.ok && row.resolved ? (
                    <>
                      <td className="px-3 py-2 align-top">{row.resolved.patientName}</td>
                      <td className="px-3 py-2 align-top">{row.resolved.professionalName}</td>
                      <td className="px-3 py-2 align-top">
                        {row.resolved.appointmentDate.split("-").reverse().join("/")} {row.resolved.startTime.slice(0, 5)}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {row.resolved.value != null ? formatCurrency(row.resolved.value) : <span className="text-warning">Pendente</span>}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Badge tone="success">{STATUS_LABELS[row.resolved.status]}</Badge>
                      </td>
                    </>
                  ) : (
                    <td className="px-3 py-2 align-top text-danger" colSpan={5}>
                      {row.errors.join(" · ")}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && <p className="text-xs font-semibold text-danger">{error}</p>}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setRows(null)}>
            Cancelar
          </Button>
          <Button size="sm" isLoading={confirming} disabled={validCount === 0} onClick={handleConfirm}>
            Confirmar importação ({validCount})
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BatchHistory({ isAdmin, initialBatches }: { isAdmin: boolean; initialBatches: ImportBatchView[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [batches, setBatches] = useState(initialBatches);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUndo(batchId: string) {
    const ok = await confirm({
      title: "Desfazer este lote?",
      description: "Remove todos os atendimentos deste lote que ainda não têm evolução clínica ou pagamento registrado. Ação irreversível.",
      confirmLabel: "Desfazer lote",
      tone: "danger",
    });
    if (!ok) return;

    setUndoingId(batchId);
    setError(null);
    const result = await undoImportBatch(batchId);
    setUndoingId(null);

    if (result.error) {
      setError(result.error);
      return;
    }
    setBatches((prev) => prev.map((b) => (b.id === batchId ? { ...b, undoneAt: new Date().toISOString() } : b)));
    router.refresh();
  }

  if (batches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm font-medium text-text-secondary">
        Nenhum lote importado ainda.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-xs font-semibold text-danger">{error}</p>}
      {batches.map((batch) => (
        <Card key={batch.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-bold text-text-primary">{batch.label}</p>
              <p className="text-xs text-text-secondary">
                {batch.rowCount} atendimento(s) · por {batch.createdByName} · {dateTimeFormatter.format(new Date(batch.createdAt))}
              </p>
            </div>
            {batch.undoneAt ? (
              <Badge tone="neutral">Desfeito</Badge>
            ) : isAdmin ? (
              <Button
                variant="danger"
                size="sm"
                isLoading={undoingId === batch.id}
                onClick={() => handleUndo(batch.id)}
              >
                Desfazer lote
              </Button>
            ) : (
              <Badge tone="warning">Só admin pode desfazer</Badge>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
