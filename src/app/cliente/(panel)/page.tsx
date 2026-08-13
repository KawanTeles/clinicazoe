import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { PageEntrance, PageEntranceItem } from "@/components/animation/PageEntrance";
import { AnimatedCard } from "@/components/animation/AnimatedCard";
import { AnimatedCounter } from "@/components/animation/AnimatedCounter";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CardContent } from "@/components/ui/Card";
import { getPatientDashboard } from "@/modules/dashboard/services/dashboard-queries";
import { getAppointmentsForPatient } from "@/modules/appointments/services/patient-queries";
import { getAttendanceInfo } from "@/lib/attendance";

export const metadata = {
  title: "Área do Cliente — Espaço Zoe",
  description: "Acompanhe seus agendamentos, histórico médico e atendimentos no Espaço Zoe.",
};

export default async function ClientePainelPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmed?: string }>;
}) {
  const { confirmed } = await searchParams;
  const session = await getCurrentUser();
  if (!session) return null;

  const patientData = await getPatientDashboard(session.user.id);
  const appointments = await getAppointmentsForPatient(session.user.id);

  return (
    <PageEntrance className="space-y-10">
      {confirmed === "1" && (
        <PageEntranceItem>
          <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-[var(--badge-bg)] px-5 py-4 shadow-card animate-fade-up">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-[var(--primary)]">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-text-primary">Conta confirmada com sucesso!</p>
              <p className="text-xs text-text-secondary">Bem-vindo(a) à Área do Cliente.</p>
            </div>
          </div>
        </PageEntranceItem>
      )}

      <PageEntranceItem>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-border/60">
          <div>
            <Badge tone="premium" className="mb-2">Paciente</Badge>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary font-heading">
              Olá, {session.profile.full_name.split(" ")[0]}
            </h1>
            <p className="text-xs text-text-secondary mt-0.5">Acompanhe seus agendamentos e atendimentos.</p>
          </div>

          <Link href="/cliente/agendar">
            <Button size="lg" className="font-bold shadow-button">
              + Novo Atendimento
            </Button>
          </Link>
        </div>
      </PageEntranceItem>

      <PageEntranceItem>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <AnimatedCard delayMs={100} className="p-6 rounded-3xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--link)] font-heading">Agendamentos Futuros</span>
            <p className="text-4xl font-black text-text-primary mt-2 font-heading">
              <AnimatedCounter value={patientData.upcoming} />
            </p>
            <p className="text-xs text-text-muted mt-1">Atendimentos pendentes de aprovação ou confirmados</p>
          </AnimatedCard>
          <AnimatedCard delayMs={200} className="p-6 rounded-3xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--link)] font-heading">Atendimentos Concluídos</span>
            <p className="text-4xl font-black text-text-primary mt-2 font-heading">
              <AnimatedCounter value={patientData.completed} />
            </p>
            <p className="text-xs text-text-muted mt-1">Histórico completo de atendimentos na Zoe</p>
          </AnimatedCard>
        </div>
      </PageEntranceItem>

      <PageEntranceItem>
        <AnimatedCard className="rounded-3xl p-0 overflow-hidden">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-text-primary font-heading">Meus Atendimentos</h3>
              <span className="text-xs text-text-muted">{appointments.length} registros</span>
            </div>

            {appointments.length === 0 ? (
              <div className="py-12 text-center space-y-4 rounded-2xl border border-dashed border-border bg-card-elevated/40">
                <p className="text-sm text-text-secondary">Você ainda não possui atendimentos agendados.</p>
                <Link href="/cliente/agendar">
                  <Button size="sm">Fazer meu primeiro agendamento</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {appointments.map((appt) => {
                  const attendance = getAttendanceInfo(appt.insuranceName, appt.payment_method, appt.modality, appt.particular_product);
                  return (
                    <div
                      key={appt.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-border bg-card-elevated/70 hover:border-primary/60 transition-all duration-200"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-text-primary font-heading">{appt.professionalName}</span>
                          <Badge
                            tone={
                              appt.status === "confirmada"
                                ? "success"
                                : appt.status === "pendente"
                                ? "warning"
                                : appt.status === "cancelada" || appt.status === "recusada"
                                ? "danger"
                                : "neutral"
                            }
                            className="text-[11px]"
                          >
                            {appt.status.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-xs text-[var(--link)] font-medium">
                          {appt.specialtyName} — {attendance.attendanceType}{" "}
                          {attendance.isConvenio
                            ? `(${attendance.insuranceName}${attendance.modalityLabel ? ` — ${attendance.modalityLabel}` : ""})`
                            : attendance.particularProductLabel
                            ? `(${attendance.particularProductLabel})`
                            : ""}
                        </p>
                        <p className="text-xs text-text-secondary">
                          Data: <strong className="text-text-primary">{appt.appointment_date.split("-").reverse().join("/")}</strong> às <strong className="text-text-primary">{appt.start_time.slice(0, 5)}</strong>
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-extrabold text-text-primary font-heading">
                          R$ {appt.value.toFixed(2)}
                        </span>
                        <p className="text-[11px] text-text-muted font-medium">
                          {attendance.isConvenio ? attendance.insuranceName : `Particular (${attendance.paymentMethodLabel})`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </AnimatedCard>
      </PageEntranceItem>
    </PageEntrance>
  );
}
