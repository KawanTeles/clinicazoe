import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listActiveProfessionalsExcept, listInactiveProfessionals } from "@/modules/evolutions/services/grant-queries";
import { AttachmentGrantsForInactiveManager } from "@/modules/evolutions/components/AttachmentGrantsForInactiveManager";

export const metadata = {
  title: "Liberações de anexos — Espaço Zoe",
};

export default async function AttachmentGrantsPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const canManage = await can(session.profile, "attachment_grants.manage_inactive");
  if (!canManage) redirect("/dashboard");

  const [inactiveProfessionals, activeProfessionals] = await Promise.all([
    listInactiveProfessionals(),
    listActiveProfessionalsExcept(session.user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">Liberações de anexos</h1>
        <p className="mt-1 max-w-3xl text-sm text-text-secondary">
          Anexos de evolução são visíveis só para quem os enviou. Quando esse profissional não está mais ativo na
          clínica, a Coordenação pode liberar o acesso para outro profissional — sempre liberando todos os anexos
          daquele autor para aquele paciente, nunca enxergando o conteúdo do anexo em si.
        </p>
      </div>

      <AttachmentGrantsForInactiveManager inactiveProfessionals={inactiveProfessionals} activeProfessionals={activeProfessionals} />
    </div>
  );
}
