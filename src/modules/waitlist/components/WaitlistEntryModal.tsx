"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";
import { insuranceRequiresModality } from "@/lib/constants";
import { createWaitlistEntry } from "@/modules/waitlist/services/waitlist-actions";
import type { Modality, WaitlistPeriod } from "@/lib/supabase/types";

interface ProfessionalOption {
  id: string;
  fullName: string;
}

interface WaitlistEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  specialtyId: string;
  specialtyName: string;
  insuranceId: string;
  insuranceName: string;
  professionals: ProfessionalOption[];
  patientProfile?: { fullName: string; phone: string | null; email?: string };
}

const PERIODS: { value: WaitlistPeriod; label: string }[] = [
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
  { value: "noite", label: "Noite" },
];

const DAYS: { value: number; label: string }[] = [
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

function ChoiceChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-full text-xs font-semibold border transition-all",
        active
          ? "border-primary bg-[var(--badge-bg)] text-[var(--primary)]"
          : "border-border text-text-secondary hover:border-primary/50",
      )}
    >
      {children}
    </button>
  );
}

export function WaitlistEntryModal({
  isOpen,
  onClose,
  specialtyId,
  specialtyName,
  insuranceId,
  insuranceName,
  professionals,
  patientProfile,
}: WaitlistEntryModalProps) {
  const [name, setName] = useState(patientProfile?.fullName || "");
  const [phone, setPhone] = useState(patientProfile?.phone || "");
  const [email, setEmail] = useState(patientProfile?.email || "");
  const [professionalId, setProfessionalId] = useState("");
  const [modality, setModality] = useState<Modality | "">("");
  const [period, setPeriod] = useState<WaitlistPeriod | "">("");
  const [days, setDays] = useState<number[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ whatsappLink?: string | null } | null>(null);

  const requiresModality = insuranceRequiresModality(insuranceName);

  function toggleDay(day: number) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function handleClose() {
    setResult(null);
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError("Nome e WhatsApp são obrigatórios.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const res = await createWaitlistEntry({
      specialtyId,
      professionalId: professionalId || undefined,
      insuranceId,
      modality: modality || undefined,
      periodPreference: period || undefined,
      preferredDays: days,
      notes: notes || undefined,
      patientName: name,
      patientPhone: phone,
      patientEmail: email || undefined,
    });

    setSubmitting(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    setResult({ whatsappLink: res.whatsappLink });
    if (res.whatsappLink) {
      window.open(res.whatsappLink, "_blank");
    }
  }

  if (result) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Você entrou na Lista de Espera" size="md">
        <div className="space-y-5 py-2 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-primary/40 bg-[var(--badge-bg)] text-[var(--primary)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <Badge tone="premium">Solicitação registrada</Badge>
          <p className="text-sm leading-relaxed text-text-secondary">
            Você foi adicionado à Lista de Espera do Espaço Zoe. Assim que surgir uma vaga compatível com sua
            solicitação, nossa equipe entrará em contato pelo WhatsApp.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
            {result.whatsappLink && (
              <a
                href={result.whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F7A3D] px-5 py-3 text-sm font-bold text-white transition-all hover:bg-[#0C6432] sm:w-auto"
              >
                Reabrir mensagem no WhatsApp
              </a>
            )}
            <Button variant="secondary" onClick={handleClose}>
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Entrar na Lista de Espera"
      subtitle={`${specialtyName} — ${insuranceName}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs font-medium text-danger">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Nome completo *" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="WhatsApp com DDD *" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="sm:col-span-2"
          />
          <Select
            label="Profissional desejado (opcional)"
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
          >
            <option value="">Sem preferência</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </Select>
          {requiresModality && (
            <Select label="Modalidade" value={modality} onChange={(e) => setModality(e.target.value as Modality)}>
              <option value="">Selecione</option>
              <option value="aba">ABA</option>
              <option value="comum">Comum</option>
            </Select>
          )}
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
            Período de preferência
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <ChoiceChip key={p.value} active={period === p.value} onClick={() => setPeriod(p.value)}>
                {p.label}
              </ChoiceChip>
            ))}
          </div>
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Disponibilidade</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <ChoiceChip key={d.value} active={days.includes(d.value)} onClick={() => toggleDay(d.value)}>
                {d.label}
              </ChoiceChip>
            ))}
          </div>
        </div>

        <Textarea
          label="Observações (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Alguma informação adicional que possa ajudar a equipe..."
        />

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={submitting} className="font-bold">
            Confirmar entrada na lista
          </Button>
        </div>
      </form>
    </Modal>
  );
}
