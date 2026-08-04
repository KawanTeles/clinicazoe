"use client";

import { useState, useEffect } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import {
  getBookableInsurances,
  getBookableProfessionals,
  getAvailableDates,
  getAvailableTimes,
  getProfessionalPricing,
} from "@/modules/appointments/services/booking-queries";
import { createPublicAppointment } from "@/modules/appointments/services/booking-actions";
import { formatCurrency } from "@/lib/whatsapp";

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
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string>("");
  const [selectedInsuranceId, setSelectedInsuranceId] = useState<string>("");
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>(defaultProfessionalId || "");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<{ slotId: string; startTime: string; endTime: string } | null>(null);

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
  const [pricingOptions, setPricingOptions] = useState<{ paymentMethod: string; value: number }[]>([]);

  // UI States
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ whatsappLink?: string | null } | null>(null);

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
    setLoading(true);
    setErrorMsg(null);
    try {
      const dates = await getAvailableDates(profId);
      setAvailableDates(dates);
      const pricing = await getProfessionalPricing(profId, selectedInsuranceId || (insurances[0]?.id ?? ""));
      setPricingOptions(pricing);
      if (pricing.length > 0) {
        setPaymentMethod(pricing[0].paymentMethod as any);
      }
      setStep(3);
    } catch {
      setErrorMsg("Falha ao carregar datas disponíveis.");
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
      );
      setAvailableTimes(times);
      setStep(4);
    } catch {
      setErrorMsg("Falha ao carregar horários disponíveis.");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectSlot(slot: { slotId: string; startTime: string; endTime: string }) {
    setSelectedSlot(slot);
    setStep(5);
  }

  function handleProceedToConfirmation(e: React.FormEvent) {
    e.preventDefault();
    if (!patientName.trim() || !patientPhone.trim()) {
      setErrorMsg("Por favor, preencha nome e telefone com DDD.");
      return;
    }
    setErrorMsg(null);
    setStep(6);
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
  const currentPricing = pricingOptions.find((p) => p.paymentMethod === paymentMethod);

  if (successResult) {
    return (
      <Card className="border-[#2E8B57]/50 bg-[#102A22] shadow-[0_20px_60px_rgba(11,61,46,0.35)] animate-fade-up">
        <CardContent className="p-8 text-center sm:p-12">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#2E8B57]/20 border border-[#2E8B57]/40 text-[#5ED39D] shadow-[0_0_30px_rgba(46,139,87,0.3)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <Badge tone="premium" className="mb-3">Agendamento Realizado!</Badge>
          <h2 className="text-3xl font-extrabold text-[#F5F7F6] tracking-tight">Consulta Solicitada com Sucesso</h2>
          <p className="mt-3 text-base text-[#C8D4CF] max-w-lg mx-auto">
            Obrigado, <strong className="text-white">{patientName}</strong>! Sua solicitação para <strong className="text-white">{selectedDate.split("-").reverse().join("/")}</strong> às <strong className="text-[#5ED39D]">{selectedSlot?.startTime.slice(0, 5)}</strong> foi registrada no sistema.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            {successResult.whatsappLink && (
              <a
                href={successResult.whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-6 py-3.5 text-sm font-bold text-white transition-all hover:bg-[#1EBE5A] shadow-[0_10px_30px_rgba(37,211,102,0.3)]"
              >
                <span>Confirmar no WhatsApp</span>
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
      <div className="rounded-2xl border border-[#255044] bg-[#102A22] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#5ED39D]">
              Passo {step} de 6
            </span>
            <h3 className="text-lg font-bold text-[#F5F7F6]">
              {step === 1 && "Escolha a Especialidade"}
              {step === 2 && "Escolha o Profissional"}
              {step === 3 && "Escolha a Data"}
              {step === 4 && "Escolha o Horário"}
              {step === 5 && "Informe seus Dados"}
              {step === 6 && "Confirmação do Agendamento"}
            </h3>
          </div>
          {step > 1 && (
            <button
              onClick={() => setStep((step - 1) as any)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#5ED39D] hover:text-[#86E5B8] transition-colors"
            >
              ← Voltar passo anterior
            </button>
          )}
        </div>

        {/* Indicator Steps */}
        <div className="grid grid-cols-6 gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i <= step ? "bg-gradient-forest shadow-[0_0_10px_rgba(46,139,87,0.5)]" : "bg-[#17382D]"
              }`}
            />
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-[#DC4F4F]/40 bg-[#DC4F4F]/10 p-4 text-sm font-medium text-[#FF8A8A]">
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
              className="group flex flex-col items-start justify-between rounded-2xl border border-[#255044] bg-[#102A22] p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-[#2E8B57] hover:bg-[#17382D]/80 hover:shadow-[0_15px_40px_rgba(11,61,46,0.3)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#17382D] text-[#5ED39D] border border-[#255044] group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <div className="mt-4">
                <h4 className="text-base font-bold text-[#F5F7F6] group-hover:text-[#5ED39D] transition-colors">
                  {spec.name}
                </h4>
                <p className="mt-1 text-xs text-[#C8D4CF]">Atendimento médico especializado</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* STEP 2: PROFISSIONAL */}
      {step === 2 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-up">
          {professionals.map((prof) => (
            <div
              key={prof.id}
              className="flex flex-col justify-between rounded-2xl border border-[#255044] bg-[#102A22] p-6 shadow-md"
            >
              <div className="flex items-center gap-4">
                <Avatar src={prof.avatarUrl} name={prof.fullName} size={64} rounded="2xl" />
                <div>
                  <h4 className="text-lg font-bold text-[#F5F7F6]">{prof.fullName}</h4>
                  <Badge tone="success" className="mt-1">{prof.specialtyName}</Badge>
                </div>
              </div>
              {prof.bio && <p className="mt-3 text-xs text-[#C8D4CF] line-clamp-2">{prof.bio}</p>}
              <Button
                className="mt-5 w-full"
                onClick={() => handleSelectProfessional(prof.id)}
                disabled={loading}
              >
                {loading ? "Carregando..." : "Selecionar Profissional"}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* STEP 3: DATA */}
      {step === 3 && (
        <Card className="animate-fade-up">
          <CardContent className="p-6">
            <h4 className="text-sm font-semibold text-[#C8D4CF] mb-4">
              Selecione uma data disponível nos próximos 45 dias:
            </h4>
            {availableDates.length === 0 ? (
              <p className="text-sm text-[#7A9187] py-6 text-center">
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
                      disabled={loading}
                      className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#255044] bg-[#17382D]/60 hover:bg-[#1F6B52]/40 hover:border-[#2E8B57] transition-all"
                    >
                      <span className="text-xs font-semibold uppercase text-[#5ED39D]">{weekDay}</span>
                      <span className="text-lg font-extrabold text-[#F5F7F6]">{d}/{m}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 4: HORÁRIO */}
      {step === 4 && (
        <Card className="animate-fade-up">
          <CardContent className="p-6">
            <h4 className="text-sm font-semibold text-[#C8D4CF] mb-4">
              Horários disponíveis para {selectedDate.split("-").reverse().join("/")}:
            </h4>
            {availableTimes.length === 0 ? (
              <p className="text-sm text-[#7A9187] py-6 text-center">
                Sem horários livres nesta data. Escolha outra data.
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
                {availableTimes.map((slot) => (
                  <button
                    key={`${slot.slotId}-${slot.startTime}`}
                    onClick={() => handleSelectSlot(slot)}
                    className="py-3 px-2 rounded-xl border border-[#255044] bg-[#17382D] text-sm font-bold text-[#F5F7F6] hover:bg-[#2E8B57]/20 hover:border-[#2E8B57] hover:text-[#5ED39D] transition-all"
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
      {step === 5 && (
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

              {pricingOptions.length > 0 && (
                <div className="mt-4">
                  <label className="text-sm font-medium text-[#C8D4CF]">Forma de Pagamento</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                    {pricingOptions.map((opt) => (
                      <button
                        type="button"
                        key={opt.paymentMethod}
                        onClick={() => setPaymentMethod(opt.paymentMethod as any)}
                        className={`p-3 rounded-xl border text-xs font-semibold text-left transition-all ${
                          paymentMethod === opt.paymentMethod
                            ? "border-[#2E8B57] bg-[#2E8B57]/20 text-[#5ED39D]"
                            : "border-[#255044] bg-[#17382D] text-[#C8D4CF]"
                        }`}
                      >
                        <div className="uppercase">{opt.paymentMethod}</div>
                        <div className="text-sm font-bold text-white mt-1">{formatCurrency(opt.value)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button type="submit" size="lg" className="w-full mt-6">
                Avançar para Confirmação →
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* STEP 6: CONFIRMAÇÃO */}
      {step === 6 && (
        <Card className="border-[#2E8B57]/40 animate-fade-up">
          <CardContent className="p-6 space-y-6">
            <h4 className="text-base font-bold text-[#F5F7F6]">Resumo das Informações</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-[#17382D]/70 p-4 border border-[#255044]">
              <div>
                <span className="text-xs text-[#7A9187]">Especialidade</span>
                <p className="text-sm font-bold text-[#F5F7F6]">{currentSpec?.name}</p>
              </div>
              <div>
                <span className="text-xs text-[#7A9187]">Profissional</span>
                <p className="text-sm font-bold text-[#F5F7F6]">{currentProf?.fullName}</p>
              </div>
              <div>
                <span className="text-xs text-[#7A9187]">Data & Horário</span>
                <p className="text-sm font-bold text-[#5ED39D]">
                  {selectedDate.split("-").reverse().join("/")} às {selectedSlot?.startTime.slice(0, 5)}
                </p>
              </div>
              <div>
                <span className="text-xs text-[#7A9187]">Paciente</span>
                <p className="text-sm font-bold text-[#F5F7F6]">{patientName} ({patientPhone})</p>
              </div>
              {currentPricing && (
                <div>
                  <span className="text-xs text-[#7A9187]">Valor estimado</span>
                  <p className="text-sm font-extrabold text-white">{formatCurrency(currentPricing.value)}</p>
                </div>
              )}
            </div>

            <Button
              size="lg"
              className="w-full text-base font-bold"
              onClick={handleFinalSubmit}
              disabled={submitting}
            >
              {submitting ? "Processando Agendamento..." : "Confirmar Agendamento"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
