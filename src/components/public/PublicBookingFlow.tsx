"use client";

import { useState, useEffect } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  getBookableInsurances,
  getBookableProfessionals,
  getAvailableDates,
  getAvailableTimes,
  getProfessionalPricing,
  getEffectiveDuration,
  type ProfessionalPricingResult,
} from "@/modules/appointments/services/booking-queries";
import { createPublicAppointment } from "@/modules/appointments/services/booking-actions";
import { formatCurrency } from "@/lib/whatsapp";
import { getAttendanceInfo } from "@/lib/attendance";
import { MODALITY_LABELS, PARTICULAR_PRODUCT_LABELS, insuranceRequiresModality } from "@/lib/constants";
import type { Modality, ParticularProduct } from "@/lib/supabase/types";

const MODALITIES: Modality[] = ["aba", "comum"];
const PARTICULAR_PAYMENT_METHODS: ("pix" | "cartao" | "dinheiro")[] = ["pix", "cartao", "dinheiro"];
const PAYMENT_METHOD_LABELS: Record<string, string> = { pix: "Pix", cartao: "Cartão", dinheiro: "Dinheiro" };

interface Specialty {
  id: string;
  name: string;
}

interface Professional {
  id: string;
  fullName: string;
  specialtyName: string;
  bio?: string | null;
  avatarUrl?: string | null;
}

interface PublicBookingFlowProps {
  specialties: Specialty[];
  initialProfessionals: Professional[];
  defaultProfessionalId?: string;
}

export function PublicBookingFlow({
  specialties,
  initialProfessionals,
  defaultProfessionalId,
}: PublicBookingFlowProps) {
  const [step, setStep] = useState<number>(1);
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string>("");
  const [selectedInsuranceId, setSelectedInsuranceId] = useState<string>("");
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>(defaultProfessionalId || "");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<{ slotId: string; startTime: string; endTime: string } | null>(null);
  const [modality, setModality] = useState<Modality | null>(null);
  const [particularProduct, setParticularProduct] = useState<ParticularProduct | null>(null);

  // Form patient
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "cartao" | "dinheiro" | "convenio">("pix");

  // Dynamic Options
  const [insurances, setInsurances] = useState<{ id: string; name: string }[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>(initialProfessionals);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [availableTimes, setAvailableTimes] = useState<{ slotId: string; startTime: string; endTime: string }[]>([]);
  const [pricing, setPricing] = useState<ProfessionalPricingResult | null>(null);
  const [effectiveDuration, setEffectiveDuration] = useState<number | null>(null);

  // UI States
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ whatsappLink?: string | null } | null>(null);

  // O convênio é escolhido automaticamente (o primeiro disponível para a
  // especialidade, sem etapa própria no site público) — mas se for Unimed ou
  // Postal Saúde, ainda precisa da etapa de Modalidade antes da agenda.
  const currentInsuranceName = insurances.find((i) => i.id === selectedInsuranceId)?.name;
  const requiresModality = insuranceRequiresModality(currentInsuranceName);
  const STEP = {
    specialty: 1,
    professional: 2,
    modality: requiresModality ? 3 : -1,
    date: requiresModality ? 4 : 3,
    time: requiresModality ? 5 : 4,
    details: requiresModality ? 6 : 5,
    confirmation: requiresModality ? 7 : 6,
  };
  const selectedValue =
    pricing?.insuranceKind === "convenio"
      ? pricing.options.find((o) => o.modality === modality)?.value ?? null
      : pricing?.insuranceKind === "particular"
        ? pricing.options.find((o) => o.product === particularProduct)?.value ?? null
        : null;

  // Auto initialize if defaultProfessionalId provided
  useEffect(() => {
    if (defaultProfessionalId && initialProfessionals.length > 0) {
      const p = initialProfessionals.find((item) => item.id === defaultProfessionalId);
      if (p) {
        const spec = specialties.find((s) => s.name === p.specialtyName);
        if (spec) {
          setSelectedSpecialtyId(spec.id);
          handleSelectSpecialty(spec.id, p.id);
        }
      }
    }
  }, [defaultProfessionalId]);

  // Abre automaticamente o WhatsApp da clínica ao concluir a solicitação —
  // o botão abaixo continua disponível como alternativa caso o navegador
  // bloqueie o popup automático.
  useEffect(() => {
    if (successResult?.whatsappLink) {
      window.open(successResult.whatsappLink, "_blank");
    }
  }, [successResult]);

  async function handleSelectSpecialty(specialtyId: string, preSelectProfId?: string) {
    setSelectedSpecialtyId(specialtyId);
    setLoading(true);
    setErrorMsg(null);
    try {
      const insList = await getBookableInsurances(specialtyId);
      setInsurances(insList);
      const defaultInsId = insList.length > 0 ? insList[0].id : "";
      setSelectedInsuranceId(defaultInsId);

      if (defaultInsId) {
        const profs = await getBookableProfessionals(specialtyId, defaultInsId);
        const currentSpecName = specialties.find((s) => s.id === specialtyId)?.name ?? "Especialista";
        const mappedProfs: Professional[] = profs.map((p) => ({
          id: p.id,
          fullName: p.fullName,
          specialtyName: currentSpecName,
          bio: p.bio,
          avatarUrl: p.avatarUrl,
        }));
        setProfessionals(mappedProfs.length > 0 ? mappedProfs : initialProfessionals);
      }
      setStep(2);
      if (preSelectProfId) {
        handleSelectProfessional(preSelectProfId);
      }
    } catch {
      setErrorMsg("Falha ao carregar opções da especialidade.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectProfessional(profId: string) {
    setSelectedProfessionalId(profId);
    setModality(null);
    setParticularProduct(null);
    setLoading(true);
    setErrorMsg(null);
    try {
      const dates = await getAvailableDates(profId);
      setAvailableDates(dates);
      const insId = selectedInsuranceId || (insurances[0]?.id ?? "");
      const pricingResult = await getProfessionalPricing(profId, insId);
      setPricing(pricingResult);
      if (insuranceRequiresModality(insurances.find((i) => i.id === insId)?.name)) {
        setStep(3);
      } else {
        const duration = await getEffectiveDuration(profId, insId);
        setEffectiveDuration(duration);
        setStep(3);
      }
    } catch {
      setErrorMsg("Falha ao carregar datas disponíveis.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectModality(m: Modality) {
    setModality(m);
    setPaymentMethod("convenio");
    setLoading(true);
    try {
      const insId = selectedInsuranceId || (insurances[0]?.id ?? "");
      const duration = await getEffectiveDuration(selectedProfessionalId, insId, m);
      setEffectiveDuration(duration);
      setStep(STEP.date);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectDate(date: string) {
    setSelectedDate(date);
    setLoading(true);
    setErrorMsg(null);
    try {
      const times = await getAvailableTimes(
        selectedProfessionalId,
        selectedInsuranceId || (insurances[0]?.id ?? ""),
        date,
        modality ?? undefined,
      );
      setAvailableTimes(times);
      setStep(STEP.time);
    } catch {
      setErrorMsg("Falha ao carregar horários disponíveis.");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectSlot(slot: { slotId: string; startTime: string; endTime: string }) {
    setSelectedSlot(slot);
    setStep(STEP.details);
  }

  function handleProceedToConfirmation(e: React.FormEvent) {
    e.preventDefault();
    if (!patientName.trim() || !patientPhone.trim()) {
      setErrorMsg("Por favor, preencha nome e telefone com DDD.");
      return;
    }
    if (!requiresModality && !particularProduct) {
      setErrorMsg("Selecione Consulta Particular ou Pacote Particular.");
      return;
    }
    setErrorMsg(null);
    setStep(STEP.confirmation);
  }

  async function handleFinalSubmit() {
    if (!selectedSlot) return;
    setSubmitting(true);
    setErrorMsg(null);

    const res = await createPublicAppointment({
      professionalId: selectedProfessionalId,
      specialtyId: selectedSpecialtyId,
      insuranceId: selectedInsuranceId || (insurances[0]?.id ?? ""),
      scheduleSlotId: selectedSlot.slotId,
      date: selectedDate,
      startTime: selectedSlot.startTime,
      endTime: selectedSlot.endTime,
      paymentMethod,
      modality: modality ?? undefined,
      particularProduct: particularProduct ?? undefined,
      patientName,
      patientPhone,
      patientEmail,
    });

    setSubmitting(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setSuccessResult({ whatsappLink: res.whatsappLink });
    }
  }

  const currentProf = professionals.find((p) => p.id === selectedProfessionalId);
  const currentSpec = specialties.find((s) => s.id === selectedSpecialtyId);
  const currentInsurance = insurances.find((i) => i.id === selectedInsuranceId);
  const attendance = getAttendanceInfo(currentInsurance?.name, paymentMethod, modality ?? undefined, particularProduct ?? undefined);

  if (successResult) {
    return (
      <Card className="border-primary/50 bg-card shadow-card animate-fade-up">
        <CardContent className="p-8 text-center sm:p-12">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--badge-bg)] border border-primary/40 text-[var(--primary)] shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <Badge tone="premium" className="mb-3">Solicitação Enviada!</Badge>
          <h2 className="text-3xl font-extrabold text-text-primary tracking-tight font-heading">Sua solicitação foi enviada com sucesso</h2>
          <p className="mt-3 text-base text-text-secondary max-w-lg mx-auto">
            Nossa equipe analisará o pedido e retornará em breve. Obrigado, <strong className="text-text-primary">{patientName}</strong>! Sua solicitação para <strong className="text-text-primary">{selectedDate.split("-").reverse().join("/")}</strong> às <strong className="text-[var(--primary)]">{selectedSlot?.startTime.slice(0, 5)}</strong> foi registrada no sistema.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            {successResult.whatsappLink && (
              <a
                href={successResult.whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F7A3D] px-6 py-3.5 text-sm font-bold text-white transition-all hover:bg-[#0C6432] shadow-md"
              >
                <span>Reabrir mensagem no WhatsApp</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </a>
            )}
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                setSuccessResult(null);
                setStep(1);
              }}
            >
              Fazer outro agendamento
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div id="agendamento-flow" className="w-full max-w-4xl mx-auto space-y-6">
      {/* Progress Bar & Header */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
              Passo {step} de {STEP.confirmation}
            </span>
            <h3 className="text-lg font-bold text-text-primary font-heading">
              {step === STEP.specialty && "Escolha a Especialidade"}
              {step === STEP.professional && "Escolha o Profissional"}
              {step === STEP.modality && "Escolha a Modalidade"}
              {step === STEP.date && "Escolha a Data"}
              {step === STEP.time && "Escolha o Horário"}
              {step === STEP.details && "Informe seus Dados"}
              {step === STEP.confirmation && "Confirmação do Agendamento"}
            </h3>
          </div>
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline transition-colors"
            >
              ← Voltar passo anterior
            </button>
          )}
        </div>

        {/* Indicator Steps */}
        <div className={requiresModality ? "grid grid-cols-7 gap-2" : "grid grid-cols-6 gap-2"}>
          {Array.from({ length: STEP.confirmation }, (_, i) => i + 1).map((i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i <= step ? "bg-gradient-forest shadow-[0_0_10px_rgba(15,164,122,0.5)]" : "bg-card-elevated"
              }`}
            />
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm font-medium text-danger">
          {errorMsg}
        </div>
      )}

      {/* STEP 1: ESPECIALIDADE */}
      {step === 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-up">
          {specialties.map((spec) => (
            <button
              key={spec.id}
              onClick={() => handleSelectSpecialty(spec.id)}
              disabled={loading}
              className="group flex flex-col items-start justify-between rounded-2xl border border-border bg-card p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:bg-card-elevated/80 hover:shadow-card-hover"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-card-elevated text-[var(--primary)] border border-border group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <div className="mt-4">
                <h4 className="text-base font-bold text-text-primary group-hover:text-[var(--primary)] transition-colors font-heading">
                  {spec.name}
                </h4>
                <p className="mt-1 text-xs text-text-secondary">Atendimento médico especializado</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* STEP 2: PROFISSIONAL */}
      {step === 2 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-up">
          {loading ? (
            <>
              <Skeleton className="h-44 rounded-2xl" />
              <Skeleton className="h-44 rounded-2xl" />
            </>
          ) : (
            professionals.map((prof) => (
              <div
                key={prof.id}
                className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-card"
              >
                <div className="flex items-center gap-4">
                  <Avatar src={prof.avatarUrl} name={prof.fullName} size={64} rounded="2xl" />
                  <div>
                    <h4 className="text-lg font-bold text-text-primary font-heading">{prof.fullName}</h4>
                    <Badge tone="success" className="mt-1">{prof.specialtyName}</Badge>
                  </div>
                </div>
                {prof.bio && <p className="mt-3 text-xs text-text-secondary line-clamp-2">{prof.bio}</p>}
                <Button
                  className="mt-5 w-full font-bold"
                  onClick={() => handleSelectProfessional(prof.id)}
                >
                  Selecionar Profissional
                </Button>
              </div>
            ))
          )}
        </div>
      )}

      {/* STEP (só Unimed/Postal Saúde): MODALIDADE */}
      {step === STEP.modality && (
        <Card className="animate-fade-up">
          <CardContent className="p-6 space-y-4">
            <h4 className="text-sm font-semibold text-text-secondary">Selecione a modalidade de atendimento:</h4>
            {loading ? (
              <Skeleton className="h-16 w-full rounded-2xl" />
            ) : pricing?.insuranceKind === "convenio" && pricing.options.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {MODALITIES.map((m) => {
                  const opt = pricing.options.find((o) => o.modality === m);
                  return (
                    <button
                      key={m}
                      disabled={!opt}
                      onClick={() => opt && handleSelectModality(m)}
                      className={`p-5 rounded-2xl border text-left transition-all ${
                        !opt
                          ? "border-border/50 bg-card-elevated/30 text-text-muted cursor-not-allowed"
                          : "border-border bg-card-elevated/70 hover:border-primary hover:bg-card-elevated"
                      }`}
                    >
                      <h5 className="text-base font-bold text-text-primary font-heading">{MODALITY_LABELS[m]}</h5>
                      <p className="text-xs text-[var(--primary)] mt-1 font-semibold">
                        {opt ? formatCurrency(opt.value) : "Sem valor cadastrado"}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-danger py-4 text-center">
                Este profissional ainda não possui um valor cadastrado para essa modalidade.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 3: DATA */}
      {step === STEP.date && (
        <Card className="animate-fade-up">
          <CardContent className="p-6">
            <h4 className="text-sm font-semibold text-text-secondary mb-4">
              Selecione uma data disponível nos próximos 45 dias:
            </h4>
            {loading ? (
              <Skeleton className="h-16 w-full rounded-2xl" />
            ) : availableDates.length === 0 ? (
              <p className="text-sm text-text-muted py-6 text-center">
                Nenhum dia disponível nos próximos dias. Tente outro profissional.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {availableDates.map((dateStr) => {
                  const [y, m, d] = dateStr.split("-");
                  const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
                  const weekDay = dateObj.toLocaleDateString("pt-BR", { weekday: "short" });
                  return (
                    <button
                      key={dateStr}
                      onClick={() => handleSelectDate(dateStr)}
                      className="flex flex-col items-center justify-center p-3 rounded-xl border border-border bg-card-elevated/60 hover:bg-surface hover:border-primary transition-all"
                    >
                      <span className="text-xs font-semibold uppercase text-[var(--primary)]">{weekDay}</span>
                      <span className="text-lg font-extrabold text-text-primary">{d}/{m}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 4: HORÁRIO */}
      {step === STEP.time && (
        <Card className="animate-fade-up">
          <CardContent className="p-6">
            <h4 className="text-sm font-semibold text-text-secondary mb-4">
              Horários disponíveis para {selectedDate.split("-").reverse().join("/")}:
            </h4>
            {loading ? (
              <Skeleton className="h-14 w-full rounded-2xl" />
            ) : availableTimes.length === 0 ? (
              <p className="text-sm text-text-muted py-6 text-center">
                Sem horários livres nesta data. Escolha outra data.
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
                {availableTimes.map((slot) => (
                  <button
                    key={`${slot.slotId}-${slot.startTime}`}
                    onClick={() => handleSelectSlot(slot)}
                    className="py-3 px-2 rounded-xl border border-border bg-card-elevated text-sm font-bold text-text-primary hover:bg-[var(--badge-bg)] hover:border-primary hover:text-[var(--primary)] transition-all"
                  >
                    {slot.startTime.slice(0, 5)}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 5: DADOS DO PACIENTE */}
      {step === STEP.details && (
        <Card className="animate-fade-up">
          <CardContent className="p-6">
            <form onSubmit={handleProceedToConfirmation} className="space-y-4">
              <Input
                label="Nome completo *"
                placeholder="Ex: Maria Silva"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                required
              />
              <Input
                label="Telefone / WhatsApp com DDD *"
                placeholder="(11) 99999-9999"
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                required
              />
              <Input
                label="E-mail (opcional)"
                type="email"
                placeholder="maria@email.com"
                value={patientEmail}
                onChange={(e) => setPatientEmail(e.target.value)}
              />

              {!requiresModality && (
                <>
                  <div className="mt-4">
                    <label className="text-sm font-medium text-text-secondary">Tipo de Atendimento Particular</label>
                    {pricing?.insuranceKind === "particular" && pricing.options.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        {pricing.options.map((opt) => (
                          <button
                            type="button"
                            key={opt.product}
                            onClick={() => setParticularProduct(opt.product)}
                            className={`p-3 rounded-xl border text-xs font-semibold text-left transition-all ${
                              particularProduct === opt.product
                                ? "border-primary bg-[var(--badge-bg)] text-[var(--primary)]"
                                : "border-border bg-card-elevated text-text-secondary"
                            }`}
                          >
                            <div>{PARTICULAR_PRODUCT_LABELS[opt.product]}</div>
                            <div className="text-sm font-bold text-text-primary mt-1">{formatCurrency(opt.value)}</div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-danger mt-2">
                        Valores particulares ainda não configurados. Entre em contato com a clínica.
                      </p>
                    )}
                  </div>

                  <div className="mt-4">
                    <label className="text-sm font-medium text-text-secondary">Forma de Pagamento</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                      {PARTICULAR_PAYMENT_METHODS.map((pm) => (
                        <button
                          type="button"
                          key={pm}
                          onClick={() => setPaymentMethod(pm)}
                          className={`p-3 rounded-xl border text-xs font-semibold text-left transition-all ${
                            paymentMethod === pm
                              ? "border-primary bg-[var(--badge-bg)] text-[var(--primary)]"
                              : "border-border bg-card-elevated text-text-secondary"
                          }`}
                        >
                          <div className="uppercase">{PAYMENT_METHOD_LABELS[pm]}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Button type="submit" size="lg" className="w-full mt-6 font-bold">
                Avançar para Confirmação →
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* STEP 6: CONFIRMAÇÃO */}
      {step === STEP.confirmation && (
        <Card className="border-primary/40 animate-fade-up">
          <CardContent className="p-6 space-y-6">
            <h4 className="text-base font-bold text-text-primary font-heading">Resumo das Informações</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-card-elevated/70 p-4 border border-border">

              <div>
                <span className="text-xs text-text-muted">Tipo de Atendimento</span>
                <p className="text-sm font-bold text-text-primary">{attendance.attendanceType}</p>
              </div>
              {attendance.isConvenio ? (
                <div>
                  <span className="text-xs text-text-muted">Convênio</span>
                  <p className="text-sm font-bold text-text-primary">
                    {attendance.insuranceName}
                    {attendance.modalityLabel ? ` — ${attendance.modalityLabel}` : ""}
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <span className="text-xs text-text-muted">Forma de Pagamento</span>
                    <p className="text-sm font-bold text-text-primary">{attendance.paymentMethodLabel}</p>
                  </div>
                  {attendance.particularProductLabel && (
                    <div>
                      <span className="text-xs text-text-muted">Produto</span>
                      <p className="text-sm font-bold text-text-primary">{attendance.particularProductLabel}</p>
                    </div>
                  )}
                </>
              )}
              <div>
                <span className="text-xs text-text-muted">Especialidade</span>
                <p className="text-sm font-bold text-text-primary">{currentSpec?.name}</p>
              </div>
              <div>
                <span className="text-xs text-text-muted">Profissional</span>
                <p className="text-sm font-bold text-text-primary">{currentProf?.fullName}</p>
              </div>
              <div>
                <span className="text-xs text-text-muted">Data & Horário</span>
                <p className="text-sm font-bold text-[var(--primary)]">
                  {selectedDate.split("-").reverse().join("/")} às {selectedSlot?.startTime.slice(0, 5)}
                </p>
              </div>
              <div>
                <span className="text-xs text-text-muted">Duração da sessão</span>
                <p className="text-sm font-bold text-text-primary">{effectiveDuration ? `${effectiveDuration} min` : "—"}</p>
              </div>
              <div>
                <span className="text-xs text-text-muted">Paciente</span>
                <p className="text-sm font-bold text-text-primary">{patientName} ({patientPhone})</p>
              </div>
              {selectedValue != null && (
                <div>
                  <span className="text-xs text-text-muted">Valor da consulta</span>
                  <p className="text-sm font-extrabold text-text-primary">{formatCurrency(selectedValue)}</p>
                </div>
              )}
            </div>

            <Button
              size="lg"
              className="w-full text-base font-bold"
              onClick={handleFinalSubmit}
              isLoading={submitting}
            >
              Confirmar Agendamento
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
