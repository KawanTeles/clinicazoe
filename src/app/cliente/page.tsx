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

export default async function ClientePublicPage() {
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
    <div className="min-h-screen bg-[#081C15] text-[#F5F7F6] flex flex-col font-sans selection:bg-[#2E8B57] selection:text-white">
      <PublicHeader clinicName={clinic.name} />

      <main className="flex-1 py-12 lg:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-10">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-[#255044]/60">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-forest text-2xl font-black text-white shadow-md">
                {session.profile.full_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge tone="premium">Paciente</Badge>
                  <PatientSignOutButton />
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{session.profile.full_name}</h1>
                <p className="text-xs text-[#5ED39D] mt-0.5">{session.profile.phone || "WhatsApp não informado"}</p>
              </div>
            </div>

            <Link href="/cliente/agendar">
              <Button size="lg" className="font-bold shadow-[0_10px_30px_rgba(20,90,67,0.4)]">
                + Nova Consulta
              </Button>
            </Link>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl bg-[#102A22] border border-[#255044] shadow-md">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5ED39D]">Agendamentos Futuros</span>
              <p className="text-4xl font-black text-white mt-2">{patientData.upcoming}</p>
              <p className="text-xs text-[#7A9187] mt-1">Consultas pendentes de aprovação ou confirmadas</p>
            </div>
            <div className="p-6 rounded-3xl bg-[#102A22] border border-[#255044] shadow-md">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5ED39D]">Consultas Concluídas</span>
              <p className="text-4xl font-black text-white mt-2">{patientData.completed}</p>
              <p className="text-xs text-[#7A9187] mt-1">Histórico completo de atendimentos na Zoe</p>
            </div>
          </div>

          {/* Appointments List */}
          <Card>
            <CardContent className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Minhas Consultas</h3>
                <span className="text-xs text-[#7A9187]">{appointments.length} registros</span>
              </div>

              {appointments.length === 0 ? (
                <div className="py-12 text-center space-y-4 rounded-2xl border border-dashed border-[#255044] bg-[#17382D]/40">
                  <p className="text-sm text-[#C8D4CF]">Você ainda não possui consultas agendadas.</p>
                  <Link href="/cliente/agendar">
                    <Button size="sm">Fazer meu primeiro agendamento</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {appointments.map((appt) => (
                    <div
                      key={appt.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-[#255044] bg-[#17382D]/70 hover:border-[#2E8B57]/60 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{appt.professionalName}</span>
                          <Badge
                            tone={
                              appt.status === "confirmada"
                                ? "success"
                                : appt.status === "pendente"
                                ? "warning"
                                : appt.status === "cancelada"
                                ? "danger"
                                : "neutral"
                            }
                            className="text-[11px]"
                          >
                            {appt.status.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-xs text-[#5ED39D]">{appt.specialtyName} — {appt.insuranceName}</p>
                        <p className="text-xs text-[#C8D4CF]">
                          Data: <strong className="text-white">{appt.appointment_date.split("-").reverse().join("/")}</strong> às <strong className="text-white">{appt.start_time.slice(0, 5)}</strong>
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-extrabold text-white">
                          R$ {appt.value.toFixed(2)}
                        </span>
                        <p className="text-[11px] text-[#7A9187] uppercase">{appt.payment_method}</p>
                      </div>
                    </div>
                  ))}
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
