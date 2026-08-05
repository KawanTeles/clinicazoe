import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPendingRequests } from "@/modules/requests/services/request-queries";
import { RequestsList } from "@/modules/requests/components/RequestsList";

export const metadata = {
  title: "Solicitações — ClinicaZoe",
};

export default async function RequestsPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!["admin", "recepcionista"].includes(session.profile.role)) redirect("/dashboard");

  const requests = await getPendingRequests();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">Solicitações</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Pedidos de agendamento enviados pela Área do Cliente, aguardando aprovação da equipe.
        </p>
      </div>

      <RequestsList requests={requests} />
    </div>
  );
}
