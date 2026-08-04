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
import { AppointmentsBarChart } from "@/modules/dashboard/components/AppointmentsBarChart";
import { RevenueBarChart } from "@/modules/dashboard/components/RevenueBarChart";

export const metadata = {
  title: "Dashboard — ClinicaZoe",
};

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-sm font-medium text-text-secondary">{label}</p>
      <p className="text-2xl font-semibold text-text-primary">{value}</p>
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
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">
            Olá, {session.profile.full_name.split(" ")[0]}
          </h1>
          <p className="text-sm text-text-secondary">Sua visão geral na ClinicaZoe.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Kpi label="Próximas consultas" value={String(data.upcoming)} />
          <Kpi label="Consultas concluídas" value={String(data.completed)} />
        </div>

        <Link href="/book">
          <Button>Agendar consulta</Button>
        </Link>
      </div>
    );
  }

  const [data, weekly] = await Promise.all([
    getStaffDashboard(role, session.user.id),
    getWeeklySeries(role, session.user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-secondary">
          {role === "profissional" ? "Visão geral da sua agenda." : "Visão geral da clínica."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Consultas hoje" value={String(data.todayCount)} />
        <Kpi label="Consultas esta semana" value={String(data.weekCount)} />
        <Kpi label="Receita prevista" value={formatCurrency(data.receitaPrevista)} />
        <Kpi label="Receita recebida" value={formatCurrency(data.receitaRecebida)} />
        {data.activeProfessionals !== null && (
          <Kpi label="Profissionais ativos" value={String(data.activeProfessionals)} />
        )}
        <Kpi label="Cancelamentos" value={String(data.cancelledCount)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Consultas por dia (últimos 7 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <AppointmentsBarChart data={weekly} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Receita por dia (últimos 7 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueBarChart data={weekly} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
