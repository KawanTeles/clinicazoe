import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getPublicWebsiteData } from "@/lib/public-queries";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { PatientSignOutButton } from "@/components/patient/PatientSignOutButton";
import { getPatientDashboard } from "@/modules/dashboard/services/dashboard-queries";
import { getAppointmentsForPatient } from "@/modules/appointments/services/patient-queries";

export const metadata = {
  title: "Área do Cliente — ClinicaZoe Portal do Paciente",
  description: "Acompanhe seus agendamentos, histórico médico e consultas na Clínica Zoe.",
};

import { getAttendanceInfo } from "@/lib/attendance";

export default async function ClientePublicPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmed?: string }>;
}) {
  const { confirmed } = await searchParams;
  const session = await getCurrentUser();

  if (!session) {
    redirect("/cliente/login");
  }

  // Se o usuário não for paciente (ex: médico ou admin acessando /cliente), pode ser retratado
  if (session.profile.role !== "paciente") {
    redirect("/dashboard");
  }

  const { clinic } = await getPublicWebsiteData();
  const patientData = await getPatientDashboard(session.user.id);
  const appointments = await getAppointmentsForPatient(session.user.id);

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col font-sans selection:bg-primary selection:text-white">
      <PublicHeader clinicName={clinic.name} />

      <main className="flex-1 py-12 lg:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-10">
          {confirmed === "1" && (
            <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-[var(--badge-bg)] px-5 py-4 shadow-card animate-fade-up">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-[var(--primary)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-text-primary">Conta confirmada com sucesso!</p>
                <p className="text-xs text-text-secondary">Bem-vindo(a) à Área do Cliente da Clínica Zoe.</p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-border/60">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-forest text-2xl font-black text-white shadow-card font-heading">
                {session.profile.full_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge tone="premium">Paciente</Badge>
                  <PatientSignOutButton />
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary font-heading">{session.profile.full_name}</h1>
                <p className="text-xs text-[var(--link)] mt-0.5">{session.profile.phone || "WhatsApp não informado"}</p>
              </div>
            </div>

            <Link href="/cliente/agendar">
              <Button size="lg" className="font-bold shadow-button">
                + Nova Consulta
              </Button>
            </Link>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl bg-card border border-border shadow-card">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--link)]">Agendamentos Futuros</span>
              <p className="text-4xl font-black text-text-primary mt-2 font-heading">{patientData.upcoming}</p>
              <p className="text-xs text-text-muted mt-1">Consultas pendentes de aprovação ou confirmadas</p>
            </div>
            <div className="p-6 rounded-3xl bg-card border border-border shadow-card">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--link)]">Consultas Concluídas</span>
              <p className="text-4xl font-black text-text-primary mt-2 font-heading">{patientData.completed}</p>
              <p className="text-xs text-text-muted mt-1">Histórico completo de atendimentos na Zoe</p>
            </div>
          </div>

          {/* Appointments List */}
          <Card>
            <CardContent className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-text-primary font-heading">Minhas Consultas</h3>
                <span className="text-xs text-text-muted">{appointments.length} registros</span>
              </div>

              {appointments.length === 0 ? (
                <div className="py-12 text-center space-y-4 rounded-2xl border border-dashed border-border bg-card-elevated/40">
                  <p className="text-sm text-text-secondary">Você ainda não possui consultas agendadas.</p>
                  <Link href="/cliente/agendar">
                    <Button size="sm">Fazer meu primeiro agendamento</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {appointments.map((appt) => {
                    const attendance = getAttendanceInfo(appt.insuranceName, appt.payment_method);
                    return (
                      <div
                        key={appt.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-border bg-card-elevated/70 hover:border-primary/60 transition-all"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-text-primary">{appt.professionalName}</span>
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
                          <p className="text-xs text-[var(--link)]">
                            {appt.specialtyName} — {attendance.attendanceType} {attendance.isConvenio ? `(${attendance.insuranceName})` : ""}
                          </p>
                          <p className="text-xs text-text-secondary">
                            Data: <strong className="text-text-primary">{appt.appointment_date.split("-").reverse().join("/")}</strong> às <strong className="text-text-primary">{appt.start_time.slice(0, 5)}</strong>
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-sm font-extrabold text-text-primary">
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
          </Card>
        </div>
      </main>

      <PublicFooter clinicName={clinic.name} address={clinic.address} whatsappNumber={clinic.whatsapp_number} />
    </div>
  );
}
