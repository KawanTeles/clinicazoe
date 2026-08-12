import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/whatsapp";
import {
  getPatientDashboard,
  getStaffDashboard,
  getWeeklySeries,
} from "@/modules/dashboard/services/dashboard-queries";
import { getWaitlistWaitingCount } from "@/modules/waitlist/services/waitlist-queries";
import { AppointmentsBarChart } from "@/modules/dashboard/components/AppointmentsBarChart";
import { RevenueBarChart } from "@/modules/dashboard/components/RevenueBarChart";

export const metadata = {
  title: "Dashboard — Espaço Zoe",
};

function Kpi({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-card-hover">
      <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-primary-dark via-primary to-primary-light opacity-60 transition-opacity group-hover:opacity-100" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">{label}</p>
        <p className="mt-2 text-3xl font-extrabold text-text-primary tracking-tight font-heading">{value}</p>
      </div>
      {subtext && <p className="mt-2 text-xs text-text-muted">{subtext}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const { role } = session.profile;

  if (role === "paciente") {
    const data = await getPatientDashboard(session.user.id);
    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">
            Olá, {session.profile.full_name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">Sua visão geral na Espaço Zoe.</p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Kpi label="Próximas consultas" value={String(data.upcoming)} subtext="Agendamentos confirmados ou pendentes" />
          <Kpi label="Consultas concluídas" value={String(data.completed)} subtext="Histórico completo de atendimentos" />
        </div>

        <div>
          <Link href="/book">
            <Button size="lg" className="shadow-button font-bold">Agendar nova consulta</Button>
          </Link>
        </div>
      </div>
    );
  }

  const [data, weekly, waitlistCount] = await Promise.all([
    getStaffDashboard(role, session.user.id),
    getWeeklySeries(role, session.user.id),
    getWaitlistWaitingCount(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">Dashboard Executivo</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {role === "profissional" ? "Visão geral da sua agenda e faturamento." : "Métricas e inteligência da clínica."}
          </p>
        </div>

        <Link href="/appointments">
          <Button variant="secondary" size="sm">
            Ver todas consultas
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Consultas hoje" value={String(data.todayCount)} subtext="Agendadas para a data atual" />
        <Kpi label="Consultas esta semana" value={String(data.weekCount)} subtext="Últimos 7 dias em atividade" />
        <Kpi label="Receita prevista" value={formatCurrency(data.receitaPrevista)} subtext="Previsão de recebimento" />
        <Kpi label="Receita recebida" value={formatCurrency(data.receitaRecebida)} subtext="Confirmados e baixados" />
        {data.activeProfessionals !== null && (
          <Kpi label="Profissionais ativos" value={String(data.activeProfessionals)} subtext="Corpo clínico disponível" />
        )}
        <Kpi label="Cancelamentos" value={String(data.cancelledCount)} subtext="Registros cancelados" />
      </div>

      <Card className="overflow-hidden">
        <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Lista de Espera</p>
            <p className="mt-1 text-2xl font-extrabold text-text-primary font-heading">
              {waitlistCount} {waitlistCount === 1 ? "paciente aguardando" : "pacientes aguardando"}
            </p>
          </div>
          <Link href="/waitlist">
            <Button variant="secondary" className="font-bold">Gerenciar Lista</Button>
          </Link>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary">Indicadores financeiros</h2>
        <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Kpi label="Faturamento do dia" value={formatCurrency(data.billingToday)} subtext="Pagamentos recebidos hoje" />
          <Kpi label="Faturamento da semana" value={formatCurrency(data.billingWeek)} subtext="Pagamentos recebidos na semana" />
          <Kpi label="Faturamento do mês" value={formatCurrency(data.billingMonth)} subtext="Pagamentos recebidos no mês" />
          <Kpi label="Consultas realizadas" value={String(data.completedCount)} subtext="Atendimentos concluídos" />
          <Kpi label="Consultas pendentes" value={String(data.pendingCount)} subtext="Aguardando confirmação" />
          <Kpi label="Consultas confirmadas" value={String(data.confirmedCount)} subtext="Confirmadas e agendadas" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Consultas por Dia (Últimos 7 Dias)</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <AppointmentsBarChart data={weekly} />
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Receita por Dia (Últimos 7 Dias)</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <RevenueBarChart data={weekly} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

