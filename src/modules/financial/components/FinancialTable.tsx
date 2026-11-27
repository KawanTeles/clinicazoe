"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/whatsapp";
import type { Role } from "@/lib/supabase/types";
import type { FinancialEntryView } from "@/modules/financial/services/financial-queries";
import { markAsPaid, markEntriesAsPaid, undoMarkAsPaid } from "@/modules/financial/services/financial-actions";
import { uploadPaymentProof, getPaymentProofUrl } from "@/modules/financial/services/payment-proof-actions";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

const PAYMENT_LABELS: Record<string, string> = {
  cartao: "Cartão",
  pix: "PIX",
  dinheiro: "Dinheiro",
  convenio: "Convênio",
};

export function FinancialTable({ entries, viewerRole }: { entries: FinancialEntryView[]; viewerRole: Role }) {
  const router = useRouter();
  const toast = useToast();
  const isFinancialStaff = viewerRole === "admin" || viewerRole === "recepcionista";

  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [markingBatch, setMarkingBatch] = useState(false);
  const [undoTarget, setUndoTarget] = useState<FinancialEntryView | null>(null);
  const [undoReason, setUndoReason] = useState("");
  const [undoSaving, setUndoSaving] = useState(false);
  const [proofTarget, setProofTarget] = useState<FinancialEntryView | null>(null);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesSearch =
        search === "" ||
        entry.patientName.toLowerCase().includes(search.toLowerCase()) ||
        entry.professionalName.toLowerCase().includes(search.toLowerCase()) ||
        entry.insuranceName.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "todos" ||
        (statusFilter === "atrasados" ? entry.isOverdue : entry.status === statusFilter);

      return matchesSearch && matchesStatus;
    });
  }, [entries, search, statusFilter]);

  const selectableIds = useMemo(
    () => filteredEntries.filter((e) => e.status === "em_aberto").map((e) => e.id),
    [filteredEntries],
  );
  const allSelectableChecked = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected(allSelectableChecked ? new Set() : new Set(selectableIds));
  }

  async function handleMarkAsPaid(id: string) {
    setBusyId(id);
    const result = await markAsPaid(id);
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Lançamento marcado como pago.");
    router.refresh();
  }

  async function handleMarkSelectedAsPaid() {
    if (selected.size === 0) return;
    setMarkingBatch(true);
    const result = await markEntriesAsPaid(Array.from(selected));
    setMarkingBatch(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setSelected(new Set());
    toast.success(
      result.skippedCount > 0
        ? `${result.paidCount} marcado(s) como pago. ${result.skippedCount} já não estavam mais em aberto.`
        : `${result.paidCount} lançamento(s) marcado(s) como pago.`,
    );
    router.refresh();
  }

  async function handleConfirmUndo() {
    if (!undoTarget) return;
    if (!undoReason.trim()) {
      toast.error("Informe o motivo de desfazer o pagamento.");
      return;
    }
    setUndoSaving(true);
    const result = await undoMarkAsPaid(undoTarget.id, undoReason);
    setUndoSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Pagamento desfeito — lançamento voltou a ficar em aberto.");
    setUndoTarget(null);
    setUndoReason("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3.5">
      {/* Search & Filter Header Bar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center justify-between rounded-xl border border-border/80 bg-card p-3 shadow-xs">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Pesquisar lançamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-1 text-xs">
          {[
            { id: "todos", label: "Todos" },
            { id: "em_aberto", label: "A receber" },
            { id: "atrasados", label: "Atrasados" },
            { id: "pago", label: "Pagos" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                statusFilter === tab.id
                  ? "bg-primary text-white shadow-xs font-bold"
                  : "bg-card-elevated/40 text-text-secondary hover:text-text-primary hover:bg-card-elevated"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isFinancialStaff && selected.size > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
          <p className="text-xs font-semibold text-text-primary">{selected.size} selecionado(s)</p>
          <Button size="sm" isLoading={markingBatch} onClick={handleMarkSelectedAsPaid}>
            Marcar selecionados como pago
          </Button>
        </div>
      )}

      {filteredEntries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-xs font-medium text-text-secondary">
          Nenhum lançamento financeiro encontrado com estes filtros.
        </div>
      ) : (
        <>
          {/* Cards — mobile/tablet */}
          <ul className="flex flex-col gap-2.5 sm:hidden">
            {filteredEntries.map((entry) => (
              <li
                key={entry.id}
                className={`rounded-2xl border p-4 shadow-card ${entry.isOverdue ? "border-danger/40 bg-danger/5" : "border-border bg-card"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-text-primary">{entry.patientName}</p>
                    <p className="truncate text-xs text-text-secondary">{entry.professionalName}</p>
                  </div>
                  {isFinancialStaff && entry.status === "em_aberto" && (
                    <input
                      type="checkbox"
                      checked={selected.has(entry.id)}
                      onChange={() => toggleSelected(entry.id)}
                      aria-label={`Selecionar lançamento de ${entry.patientName}`}
                      className="mt-1 h-4 w-4 shrink-0"
                    />
                  )}
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {entry.insuranceName} · {PAYMENT_LABELS[entry.paymentMethod] ?? entry.paymentMethod}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                    {dateFormatter.format(new Date(`${entry.dueDate}T00:00:00`))}
                    {entry.isOverdue && (
                      <Badge tone="danger" className="text-[10px]">Atrasado</Badge>
                    )}
                  </div>
                  <p className="font-black text-text-primary">{formatCurrency(entry.value)}</p>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <Badge tone={entry.status === "pago" ? "success" : "warning"} className="text-[10px]">
                    {entry.status === "pago" ? "Pago" : "Em aberto"}
                  </Badge>
                  {entry.status === "pago" && entry.paidAt && (
                    <span className="text-[11px] text-text-muted">
                      {entry.paidByName ?? "—"} · {dateFormatter.format(new Date(entry.paidAt))}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
                  {isFinancialStaff && entry.status === "em_aberto" && (
                    <Button size="sm" isLoading={busyId === entry.id} onClick={() => handleMarkAsPaid(entry.id)} className="flex-1 text-[11px]">
                      Marcar como pago
                    </Button>
                  )}
                  {isFinancialStaff && entry.status === "pago" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-[11px]"
                      onClick={() => {
                        setUndoTarget(entry);
                        setUndoReason("");
                      }}
                    >
                      Desfazer
                    </Button>
                  )}
                  {isFinancialStaff ? (
                    <Button size="sm" variant="outline" className="flex-1 text-[11px]" onClick={() => setProofTarget(entry)}>
                      {entry.hasProof ? "Ver comprovante" : "Anexar comprovante"}
                    </Button>
                  ) : entry.hasProof ? (
                    <Badge tone="neutral" className="text-[10px]">Comprovante anexado</Badge>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          {/* Tabela — desktop */}
          <div className="hidden overflow-x-auto rounded-xl border border-border/80 bg-card shadow-xs sm:block">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="border-b border-border/80 bg-card-elevated/70 text-[11px] font-bold uppercase tracking-wider text-text-secondary">
              <tr>
                {isFinancialStaff && (
                  <th className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={allSelectableChecked}
                      disabled={selectableIds.length === 0}
                      onChange={toggleSelectAll}
                      aria-label="Selecionar todos"
                    />
                  </th>
                )}
                <th className="px-4 py-2.5 font-bold">Paciente</th>
                <th className="px-4 py-2.5 font-bold">Profissional</th>
                <th className="px-4 py-2.5 font-bold">Convênio</th>
                <th className="px-4 py-2.5 font-bold">Forma</th>
                <th className="px-4 py-2.5 font-bold">Vencimento</th>
                <th className="px-4 py-2.5 font-bold">Valor</th>
                <th className="px-4 py-2.5 font-bold">Status</th>
                <th className="px-4 py-2.5 font-bold">Pago por / quando</th>
                <th className="px-4 py-2.5 font-bold">Comprovante</th>
                <th className="px-4 py-2.5 font-bold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredEntries.map((entry) => (
                <tr
                  key={entry.id}
                  className={`transition-colors hover:bg-card-elevated/40 ${entry.isOverdue ? "bg-danger/5" : ""}`}
                >
                  {isFinancialStaff && (
                    <td className="px-3 py-3">
                      {entry.status === "em_aberto" && (
                        <input
                          type="checkbox"
                          checked={selected.has(entry.id)}
                          onChange={() => toggleSelected(entry.id)}
                          aria-label={`Selecionar lançamento de ${entry.patientName}`}
                        />
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 font-bold text-text-primary">{entry.patientName}</td>
                  <td className="px-4 py-3 font-semibold text-text-primary">{entry.professionalName}</td>
                  <td className="px-4 py-3 text-text-secondary">{entry.insuranceName}</td>
                  <td className="px-4 py-3 text-text-secondary">{PAYMENT_LABELS[entry.paymentMethod] ?? entry.paymentMethod}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {dateFormatter.format(new Date(`${entry.dueDate}T00:00:00`))}
                    {entry.isOverdue && (
                      <Badge tone="danger" className="ml-1.5 text-[10px]">
                        Atrasado
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 font-bold text-text-primary">{formatCurrency(entry.value)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={entry.status === "pago" ? "success" : "warning"} className="text-[10px]">
                      {entry.status === "pago" ? "Pago" : "Em aberto"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {entry.status === "pago" && entry.paidAt ? (
                      <span>
                        {entry.paidByName ?? "—"}
                        <br />
                        {dateFormatter.format(new Date(entry.paidAt))}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isFinancialStaff ? (
                      <Button size="sm" variant="outline" className="h-7 text-[11px] px-2" onClick={() => setProofTarget(entry)}>
                        {entry.hasProof ? "Ver" : "Anexar"}
                      </Button>
                    ) : entry.hasProof ? (
                      <Badge tone="neutral" className="text-[10px]">
                        Anexado
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {isFinancialStaff && entry.status === "em_aberto" && (
                        <Button
                          size="sm"
                          isLoading={busyId === entry.id}
                          onClick={() => handleMarkAsPaid(entry.id)}
                          className="h-7 text-[11px] px-2.5 font-semibold"
                        >
                          Marcar como pago
                        </Button>
                      )}
                      {isFinancialStaff && entry.status === "pago" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] px-2.5"
                          onClick={() => {
                            setUndoTarget(entry);
                            setUndoReason("");
                          }}
                        >
                          Desfazer
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}

      <Modal
        isOpen={undoTarget != null}
        onClose={() => setUndoTarget(null)}
        title="Desfazer pagamento"
        subtitle={undoTarget ? `${undoTarget.patientName} — ${formatCurrency(undoTarget.value)}` : undefined}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setUndoTarget(null)}>
              Cancelar
            </Button>
            <Button size="sm" variant="danger" isLoading={undoSaving} onClick={handleConfirmUndo}>
              Confirmar
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-xs text-text-secondary">
            O lançamento volta a ficar &quot;Em aberto&quot;. Essa ação é registrada com seu nome, data/hora e o motivo
            informado abaixo.
          </p>
          <Textarea
            label="Motivo (obrigatório)"
            value={undoReason}
            onChange={(e) => setUndoReason(e.target.value)}
            rows={3}
            placeholder="Ex.: marcado como pago por engano, baixa duplicada..."
          />
        </div>
      </Modal>

      {proofTarget && (
        <PaymentProofModal entry={proofTarget} onClose={() => setProofTarget(null)} onUploaded={() => router.refresh()} />
      )}
    </div>
  );
}

function PaymentProofModal({
  entry,
  onClose,
  onUploaded,
}: {
  entry: FinancialEntryView;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [viewUrl, setViewUrl] = useState<string | null>(null);

  async function handleView() {
    setLoadingUrl(true);
    const result = await getPaymentProofUrl(entry.id);
    setLoadingUrl(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setViewUrl(result.url);
  }

  async function handleUpload() {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    const result = await uploadPaymentProof(entry.id, formData);
    setUploading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Comprovante salvo.");
    setFile(null);
    onUploaded();
    onClose();
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Comprovante de pagamento"
      subtitle={`${entry.patientName} — ${formatCurrency(entry.value)}`}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Fechar
          </Button>
          <Button size="sm" isLoading={uploading} disabled={!file} onClick={handleUpload}>
            {entry.hasProof ? "Substituir" : "Enviar"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {entry.hasProof && (
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card-elevated/40 p-3">
            <span className="text-xs font-semibold text-text-primary">Já existe um comprovante anexado.</span>
            <Button size="sm" variant="outline" isLoading={loadingUrl} onClick={handleView}>
              Visualizar
            </Button>
          </div>
        )}
        {viewUrl && (
          <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[var(--primary)] underline">
            Abrir comprovante em nova aba
          </a>
        )}
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-text-secondary">
            {entry.hasProof ? "Enviar novo (substitui o atual)" : "Imagem (PNG/JPEG/WEBP) ou PDF — até 5MB"}
          </label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-text-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-card-elevated file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-text-primary"
          />
        </div>
      </div>
    </Modal>
  );
}
