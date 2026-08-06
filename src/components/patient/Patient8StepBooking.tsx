"use client";

import { useEffect, useState } from "react";
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
import { createAppointment } from "@/modules/appointments/services/booking-actions";
import { formatCurrency, buildWhatsAppLink } from "@/lib/whatsapp";
import { getAttendanceInfo } from "@/lib/attendance";
import { MODALITY_LABELS, PARTICULAR_PRODUCT_LABELS, insuranceRequiresModality } from "@/lib/constants";
import type { Modality, ParticularProduct } from "@/lib/supabase/types";

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

interface Patient8StepBookingProps {
  specialties: Specialty[];
  initialProfessionals: Professional[];
  patientProfile?: {
    fullName: string;
    phone: string | null;
    email?: string;
  };
  whatsappNumber?: string | null;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "Pix",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  convenio: "Convênio",
};

/** "Cartão" cobre um único preço cadastrado pelo profissional (sem distinção
 * de crédito/débito no banco) — aqui só desdobramos a apresentação em duas
 * opções de mesma tarifa, sem alterar o valor nem o payment_method salvo. */
function paymentMethodDisplayLabel(
  paymentMethod: string,
  cardType: "credito" | "debito",
): string {
  if (paymentMethod === "cartao") {
    return cardType === "credito" ? "Cartão de Crédito" : "Cartão de Débito";
  }
  return PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod;
}

interface PaymentChoice {
  key: string;
  paymentMethod: "pix" | "cartao" | "dinheiro" | "convenio";
  cardType?: "credito" | "debito";
  label: string;
}

const MODALITIES: Modality[] = ["aba", "comum"];

export function Patient8StepBooking({
  specialties,
  initialProfessionals,
  patientProfile,
  whatsappNumber,
}: Patient8StepBookingProps) {
  const [step, setStep] = useState<number>(1);

  // Selections
  const [selectedInsuranceId, setSelectedInsuranceId] = useState<string>("");
  const [selectedInsuranceName, setSelectedInsuranceName] = useState<string>("");
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string>("");
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<{ slotId: string; startTime: string; endTime: string } | null>(null);
  const [modality, setModality] = useState<Modality | null>(null);
  const [particularProduct, setParticularProduct] = useState<ParticularProduct | null>(null);

  // Form patient
  const [patientName, setPatientName] = useState(patientProfile?.fullName || "");
  const [patientPhone, setPatientPhone] = useState(patientProfile?.phone || "");
  const [patientEmail, setPatientEmail] = useState(patientProfile?.email || "");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "cartao" | "dinheiro" | "convenio">("pix");
  const [cardType, setCardType] = useState<"credito" | "debito">("credito");

  // Dynamic lists
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

  // Unimed/Postal Saúde têm modalidade (ABA/Comum) e ganham uma etapa extra;
  // Particular não tem modalidade, mas ganha a etapa de Forma de Pagamento —
  // por isso o total continua 7 etapas nos dois casos.
  const requiresModality = insuranceRequiresModality(selectedInsuranceName);
  const STEP = {
    insurance: 1,
    professional: 2,
    modality: requiresModality ? 3 : -1,
    date: requiresModality ? 4 : 3,
    time: requiresModality ? 5 : 4,
    patientDetails: requiresModality ? 6 : 5,
    payment: requiresModality ? -1 : 6,
    summary: 7,
  };
  const selectedValue =
    pricing?.insuranceKind === "convenio"
      ? pricing.options.find((o) => o.modality === modality)?.value ?? null
      : pricing?.insuranceKind === "particular"
        ? pricing.options.find((o) => o.product === particularProduct)?.value ?? null
        : null;

  async function loadInsurancesForSpecialty(specId: string) {
    setSelectedSpecialtyId(specId);
    setLoading(true);
    setErrorMsg(null);
    try {
      const insList = await getBookableInsurances(specId);
      setInsurances(insList);
      if (insList.length > 0) {
        setSelectedInsuranceId(insList[0].id);
        setSelectedInsuranceName(insList[0].name);
      }
    } catch {
      setErrorMsg("Falha ao carregar convênios disponíveis.");
    } finally {
      setLoading(false);
    }
  }

  // Carrega os convênios da primeira especialidade assim que o wizard abre —
  // a clínica opera numa única unidade, então não há mais etapa de cidade
  // antes disso.
  useEffect(() => {
    if (specialties.length > 0) {
      void loadInsurancesForSpecialty(specialties[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Abre automaticamente o WhatsApp da clínica ao concluir a solicitação —
  // o botão abaixo continua disponível como alternativa caso o navegador
  // bloqueie o popup automático.
  useEffect(() => {
    if (successResult?.whatsappLink) {
      window.open(successResult.whatsappLink, "_blank");
    }
  }, [successResult]);

  // ETAPA 1: Selecionar Convênio
  async function handleSelectInsurance(insId: string, insName: string) {
    setSelectedInsuranceId(insId);
    setSelectedInsuranceName(insName);
    setModality(null);
    setParticularProduct(null);
    setPaymentMethod("pix");
    setLoading(true);
    setErrorMsg(null);
    try {
      const specId = selectedSpecialtyId || (specialties[0]?.id ?? "");
      const profs = await getBookableProfessionals(specId, insId);
      const specName = specialties.find((s) => s.id === specId)?.name ?? "Especialista";
      const mapped: Professional[] = profs.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        specialtyName: specName,
        bio: p.bio,
        avatarUrl: p.avatarUrl,
      }));
      setProfessionals(mapped.length > 0 ? mapped : initialProfessionals);
      setStep(2);
    } catch {
      setErrorMsg("Falha ao carregar profissionais.");
    } finally {
      setLoading(false);
    }
  }

  // ETAPA 2: Selecionar Profissional
  async function handleSelectProfessional(profId: string) {
    setSelectedProfessionalId(profId);
    setModality(null);
    setParticularProduct(null);
    setLoading(true);
    setErrorMsg(null);
    try {
      const [dates, pricingResult] = await Promise.all([
        getAvailableDates(profId),
        getProfessionalPricing(profId, selectedInsuranceId),
      ]);
      setAvailableDates(dates);
      setPricing(pricingResult);
      if (requiresModality) {
        setStep(STEP.modality);
      } else {
        const duration = await getEffectiveDuration(profId, selectedInsuranceId);
        setEffectiveDuration(duration);
        setStep(STEP.date);
      }
    } catch {
      setErrorMsg("Falha ao carregar datas do profissional.");
    } finally {
      setLoading(false);
    }
  }

  // ETAPA 3 (só Unimed/Postal Saúde): Escolher Modalidade
  async function handleSelectModality(m: Modality) {
    setModality(m);
    setPaymentMethod("convenio");
    setLoading(true);
    setErrorMsg(null);
    try {
      const duration = await getEffectiveDuration(selectedProfessionalId, selectedInsuranceId, m);
      setEffectiveDuration(duration);
      setStep(STEP.date);
    } finally {
      setLoading(false);
    }
  }

  // ETAPA "Data": Escolher Data
  async function handleSelectDate(date: string) {
    setSelectedDate(date);
    setLoading(true);
    setErrorMsg(null);
    try {
      const times = await getAvailableTimes(selectedProfessionalId, selectedInsuranceId, date, modality ?? undefined);
      setAvailableTimes(times);
      setStep(STEP.time);
    } catch {
      setErrorMsg("Falha ao carregar horários disponíveis.");
    } finally {
      setLoading(false);
    }
  }

  // ETAPA "Horário": Escolher Horário
  function handleSelectSlot(slot: { slotId: string; startTime: string; endTime: string }) {
    setSelectedSlot(slot);
    setStep(STEP.patientDetails);
  }

  // ETAPA "Dados Pessoais"
  function handleConfirmPatientDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!patientName.trim() || !patientPhone.trim()) {
      setErrorMsg("Nome e WhatsApp são obrigatórios.");
      return;
    }
    setErrorMsg(null);
    // Convênio (Unimed/Postal): forma de pagamento já é fixa ("convenio") e a
    // modalidade já foi escolhida — vai direto para o resumo. Particular:
    // ainda falta escolher Consulta/Pacote + forma de pagamento.
    setStep(requiresModality ? STEP.summary : STEP.payment);
  }

  // ETAPA "Forma de Pagamento" (só Particular)
  function handleSelectPaymentChoice(choice: PaymentChoice) {
    setPaymentMethod(choice.paymentMethod);
    if (choice.cardType) setCardType(choice.cardType);
  }

  function handleConfirmPayment() {
    if (!particularProduct) {
      setErrorMsg("Selecione Consulta Particular ou Pacote Particular.");
      return;
    }
    setErrorMsg(null);
    setStep(STEP.summary);
  }

  // ETAPA "Resumo": Enviar solicitação
  async function handleFinalSubmit() {
    if (!selectedSlot) return;
    setSubmitting(true);
    setErrorMsg(null);

    const res = await createAppointment({
      professionalId: selectedProfessionalId,
      specialtyId: selectedSpecialtyId || (specialties[0]?.id ?? ""),
      insuranceId: selectedInsuranceId,
      scheduleSlotId: selectedSlot.slotId,
      date: selectedDate,
      startTime: selectedSlot.startTime,
      endTime: selectedSlot.endTime,
      paymentMethod,
      modality: modality ?? undefined,
      particularProduct: particularProduct ?? undefined,
    });

    setSubmitting(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else {
      const currentProf = professionals.find((p) => p.id === selectedProfessionalId);
      const currentSpec = specialties.find((s) => s.id === selectedSpecialtyId);

      const attendance = getAttendanceInfo(selectedInsuranceName, paymentMethod, modality ?? undefined, particularProduct ?? undefined);
      let detailsText = `📄 Tipo de Atendimento: ${attendance.attendanceType}\n`;
      if (attendance.isConvenio) {
        detailsText += `🏥 Convênio: ${attendance.insuranceName}\n`;
        if (attendance.modalityLabel) detailsText += `🧩 Modalidade: ${attendance.modalityLabel}\n`;
      } else {
        detailsText += `💳 Forma de Pagamento: ${paymentMethodDisplayLabel(paymentMethod, cardType)}\n`;
        if (attendance.particularProductLabel) detailsText += `📦 ${attendance.particularProductLabel}\n`;
      }

      const msg = `Nova solicitação de consulta:\n\nPaciente: ${patientName}\nWhatsApp: ${patientPhone}\nProfissional: ${currentProf?.fullName}\nEspecialidade: ${currentSpec?.name}\nData: ${selectedDate.split("-").reverse().join("/")}\nHorário: ${selectedSlot.startTime.slice(0, 5)}\n💰 Valor da Consulta: ${selectedValue != null ? formatCurrency(selectedValue) : "A combinar"}\n${detailsText.trim()}`;

      const link = buildWhatsAppLink(whatsappNumber, msg);
      setSuccessResult({ whatsappLink: link });
    }
  }

  const currentProf = professionals.find((p) => p.id === selectedProfessionalId);
  const currentSpec = specialties.find((s) => s.id === selectedSpecialtyId);
  const attendance = getAttendanceInfo(selectedInsuranceName, paymentMethod, modality ?? undefined, particularProduct ?? undefined);

  // "Cartão" vira duas opções na tela (Crédito/Débito) — mesma escolha
  // informativa, não afeta o valor (que agora vem do Produto Particular).
  const paymentChoices: PaymentChoice[] =
    !requiresModality
      ? [
          { key: "pix", paymentMethod: "pix", label: "Pix" },
          { key: "cartao-credito", paymentMethod: "cartao", cardType: "credito", label: "Cartão de Crédito" },
          { key: "cartao-debito", paymentMethod: "cartao", cardType: "debito", label: "Cartão de Débito" },
          { key: "dinheiro", paymentMethod: "dinheiro", label: "Dinheiro" },
        ]
      : [];
  const selectedChoiceKey = paymentMethod === "cartao" ? `cartao-${cardType}` : paymentMethod;

  if (successResult) {
    return (
      <Card className="border-primary/50 bg-card shadow-card animate-fade-up">
        <CardContent className="p-8 text-center sm:p-12 space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--badge-bg)] border border-primary/40 text-[var(--primary)] shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <Badge tone="premium" className="mb-2">Solicitação Enviada!</Badge>
          <h2 className="text-3xl font-black text-text-primary tracking-tight font-heading">Sua solicitação foi enviada com sucesso</h2>
          <p className="text-base text-text-secondary max-w-lg mx-auto leading-relaxed">
            Nossa equipe analisará o pedido e retornará em breve. Olá <strong className="text-text-primary">{patientName}</strong>, sua solicitação para <strong className="text-[var(--primary)]">{selectedDate.split("-").reverse().join("/")}</strong> às <strong className="text-[var(--primary)]">{selectedSlot?.startTime.slice(0, 5)}</strong> foi registrada na clínica.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            {successResult.whatsappLink && (
              <a
                href={successResult.whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-6 py-4 text-sm font-bold text-white transition-all hover:bg-[#1EBE5A] shadow-md"
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
              Fazer novo agendamento
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Progress Indicator */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
              Etapa {step} de 7
            </span>
            <h3 className="text-lg font-extrabold text-text-primary font-heading">
              {step === STEP.insurance && "1. Selecionar Convênio"}
              {step === STEP.professional && "2. Selecionar Profissional"}
              {step === STEP.modality && "3. Modalidade"}
              {step === STEP.date && `${STEP.date}. Escolher Data`}
              {step === STEP.time && `${STEP.time}. Escolher Horário`}
              {step === STEP.patientDetails && `${STEP.patientDetails}. Confirmar Dados Pessoais`}
              {step === STEP.payment && `${STEP.payment}. Forma de Pagamento`}
              {step === STEP.summary && "7. Resumo Final & Envio"}
            </h3>
          </div>
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline transition-colors"
            >
              ← Voltar etapa anterior
            </button>
          )}
        </div>

        {/* 7 Indicator Bars */}
        <div className="grid grid-cols-7 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
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

      {/* ETAPA 1: SELEÇÃO DE CONVÊNIO */}
      {step === 1 && (
        <Card className="animate-fade-up">
          <CardContent className="p-6 space-y-4">
            <h4 className="text-sm font-semibold text-text-secondary">Selecione o plano de saúde ou atendimento particular:</h4>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
              </div>
            ) : insurances.length === 0 ? (
              <p className="text-sm text-text-muted py-4 text-center">Nenhum convênio disponível para esta seleção.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {insurances.map((ins) => (
                  <button
                    key={ins.id}
                    onClick={() => handleSelectInsurance(ins.id, ins.name)}
                    className="p-5 rounded-2xl border border-border bg-card-elevated/70 text-left hover:border-primary hover:bg-card-elevated transition-all"
                  >
                    <h5 className="text-base font-bold text-text-primary font-heading">{ins.name}</h5>
                    <p className="text-xs text-[var(--primary)] mt-1">Compatível com corpo médico</p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ETAPA 2: SELEÇÃO DE PROFISSIONAL */}
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
                  Selecionar Médico
                </Button>
              </div>
            ))
          )}
        </div>
      )}

      {/* ETAPA 3 (só Unimed/Postal Saúde): MODALIDADE */}
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

      {/* ETAPA "Data": ESCOLHER DATA */}
      {step === STEP.date && (
        <Card className="animate-fade-up">
          <CardContent className="p-6">
            <h4 className="text-sm font-semibold text-text-secondary mb-4">
              Datas disponíveis para {currentProf?.fullName}:
            </h4>
            {loading ? (
              <Skeleton className="h-16 w-full rounded-2xl" />
            ) : availableDates.length === 0 ? (
              <p className="text-sm text-text-muted py-6 text-center">
                Nenhum dia disponível nos próximos 45 dias.
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
                      <span className="text-lg font-black text-text-primary">{d}/{m}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ETAPA "Horário": ESCOLHER HORÁRIO */}
      {step === STEP.time && (
        <Card className="animate-fade-up">
          <CardContent className="p-6">
            <h4 className="text-sm font-semibold text-text-secondary mb-4">
              Horários livres para {selectedDate.split("-").reverse().join("/")}:
            </h4>
            {loading ? (
              <Skeleton className="h-14 w-full rounded-2xl" />
            ) : availableTimes.length === 0 ? (
              <p className="text-sm text-text-muted py-6 text-center">
                Sem horários disponíveis para esta data. Escolha outro dia.
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

      {/* ETAPA "Dados Pessoais": CONFIRMAR DADOS PESSOAIS */}
      {step === STEP.patientDetails && (
        <Card className="animate-fade-up">
          <CardContent className="p-6">
            <form onSubmit={handleConfirmPatientDetails} className="space-y-4">
              <Input
                label="Nome completo *"
                placeholder="Ex: Maria Oliveira"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                required
              />
              <Input
                label="WhatsApp com DDD *"
                placeholder="(11) 99999-9999"
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                required
              />
              <Input
                label="E-mail *"
                type="email"
                placeholder="maria@email.com"
                value={patientEmail}
                onChange={(e) => setPatientEmail(e.target.value)}
                required
              />
              <Button type="submit" size="lg" className="w-full mt-6 font-bold">
                {requiresModality ? "Avançar para Resumo →" : "Avançar para Pagamento →"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ETAPA "Forma de Pagamento" (só Particular): PRODUTO + PAGAMENTO */}
      {step === STEP.payment && (
        <Card className="animate-fade-up">
          <CardContent className="p-6 space-y-5">
            <div>
              <h4 className="text-sm font-semibold text-text-secondary mb-3">Selecione o tipo de atendimento particular:</h4>
              {pricing?.insuranceKind === "particular" && pricing.options.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {pricing.options.map((opt) => (
                    <button
                      key={opt.product}
                      onClick={() => setParticularProduct(opt.product)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        particularProduct === opt.product
                          ? "border-primary bg-[var(--badge-bg)] text-[var(--primary)]"
                          : "border-border bg-card-elevated text-text-secondary"
                      }`}
                    >
                      <div className="font-bold text-base text-text-primary">{PARTICULAR_PRODUCT_LABELS[opt.product]}</div>
                      <div className="text-xs text-[var(--primary)] font-semibold mt-1">{formatCurrency(opt.value)}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted py-4 text-center">
                  Valores particulares ainda não configurados. Entre em contato com a clínica.
                </p>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-text-secondary mb-3">Selecione a forma de pagamento:</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {paymentChoices.map((choice) => (
                  <button
                    key={choice.key}
                    onClick={() => handleSelectPaymentChoice(choice)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      selectedChoiceKey === choice.key
                        ? "border-primary bg-[var(--badge-bg)] text-[var(--primary)]"
                        : "border-border bg-card-elevated text-text-secondary"
                    }`}
                  >
                    <div className="font-bold text-base text-text-primary">{choice.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <Button size="lg" className="w-full mt-2 font-bold" onClick={handleConfirmPayment}>
              Avançar para Resumo →
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ETAPA "Resumo": RESUMO FINAL & ENVIO */}
      {step === STEP.summary && (
        <Card className="border-primary/40 animate-fade-up">
          <CardContent className="p-6 space-y-6">
            <h4 className="text-base font-bold text-text-primary font-heading">Resumo Completo da Solicitação</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-card-elevated/70 p-5 border border-border text-xs">
              <div>
                <span className="text-text-muted">Convênio:</span>
                <p className="text-sm font-bold text-text-primary mt-0.5">
                  {selectedInsuranceName}
                  {attendance.modalityLabel ? ` — ${attendance.modalityLabel}` : ""}
                </p>
              </div>
              <div>
                <span className="text-text-muted">Profissional:</span>
                <p className="text-sm font-bold text-text-primary mt-0.5">{currentProf?.fullName}</p>
              </div>
              <div>
                <span className="text-text-muted">Especialidade:</span>
                <p className="text-sm font-bold text-text-primary mt-0.5">{currentSpec?.name}</p>
              </div>
              <div>
                <span className="text-text-muted">Duração da sessão:</span>
                <p className="text-sm font-bold text-text-primary mt-0.5">
                  {effectiveDuration ? `${effectiveDuration} min` : "—"}
                </p>
              </div>
              <div>
                <span className="text-text-muted">Data & Horário:</span>
                <p className="text-sm font-bold text-[var(--primary)] mt-0.5">
                  {selectedDate.split("-").reverse().join("/")} às {selectedSlot?.startTime.slice(0, 5)}
                </p>
              </div>
              <div>
                <span className="text-text-muted">Paciente:</span>
                <p className="text-sm font-bold text-text-primary mt-0.5">{patientName} ({patientPhone})</p>
              </div>
              {selectedValue != null && (
                <div>
                  <span className="text-text-muted">Valor da consulta:</span>
                  <p className="text-sm font-black text-[var(--primary)] mt-0.5">{formatCurrency(selectedValue)}</p>
                </div>
              )}
              {!requiresModality && (
                <div>
                  <span className="text-text-muted">Pagamento:</span>
                  <p className="text-sm font-bold text-text-primary mt-0.5">
                    {attendance.particularProductLabel ? `${attendance.particularProductLabel} — ` : ""}
                    {paymentMethodDisplayLabel(paymentMethod, cardType)}
                  </p>
                </div>
              )}
            </div>

            <Button
              size="lg"
              className="w-full text-base font-bold py-4 shadow-button"
              onClick={handleFinalSubmit}
              isLoading={submitting}
            >
              Confirmar solicitação
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
