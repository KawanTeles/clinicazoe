import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getManagedProtocolTemplates } from "@/modules/protocols/services/protocol-queries";
import { getActiveSpecialties } from "@/modules/specialties/services/specialty-queries";
import { ProtocolTemplateManager } from "@/modules/protocols/components/ProtocolTemplateManager";

export const metadata = {
  title: "Protocolos de Avaliação — Espaço Zoe",
};

export default async function ProtocolTemplatesPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const [canManageOwn, canManageShared] = await Promise.all([
    can(session.profile, "protocol_templates.manage.own"),
    can(session.profile, "protocol_templates.manage.shared"),
  ]);

  if (!canManageOwn && !canManageShared) redirect("/dashboard");

  const [templates, specialties] = await Promise.all([
    getManagedProtocolTemplates({
      ownProfessionalId: canManageOwn ? session.user.id : undefined,
      includeShared: canManageShared,
    }),
    canManageShared ? getActiveSpecialties() : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">Protocolos de Avaliação</h1>
        <p className="mt-1 max-w-3xl text-sm text-text-secondary">
          Biblioteca de protocolos/checklists para aplicar em pacientes. Nasce vazia de propósito — monte o seu próprio
          protocolo pelo construtor abaixo ou importe os itens de uma planilha (CSV).
        </p>
      </div>

      <ProtocolTemplateManager
        templates={templates}
        specialties={specialties}
        canManageOwn={canManageOwn}
        canManageShared={canManageShared}
      />
    </div>
  );
}
