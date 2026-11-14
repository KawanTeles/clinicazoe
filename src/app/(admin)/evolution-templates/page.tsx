import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getEvolutionTemplates } from "@/modules/evolutions/services/template-queries";
import { getActiveSpecialties } from "@/modules/specialties/services/specialty-queries";
import { EvolutionTemplateManager } from "@/modules/evolutions/components/EvolutionTemplateManager";

export const metadata = {
  title: "Modelos de evolução — Espaço Zoe",
};

export default async function EvolutionTemplatesPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  // Duas permissões diferentes, dois escopos de edição: o profissional mexe no
  // modelo DELE; admin e coordenação mexem no padrão da área. Quem acumula os
  // dois papéis (Etapa 78) tem as duas — e a tela mostra as duas seções.
  const [canManageOwn, canManageShared] = await Promise.all([
    can(session.profile, "evolution_templates.manage.own"),
    can(session.profile, "evolution_templates.manage.shared"),
  ]);

  if (!canManageOwn && !canManageShared) redirect("/dashboard");

  const [templates, specialties] = await Promise.all([
    getEvolutionTemplates(),
    canManageShared ? getActiveSpecialties() : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">
          Modelos de evolução
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-text-secondary">
          Os tópicos que aparecem no formulário de evolução. O padrão da clínica é um tópico único de texto livre;
          quem preferir pode dividir em mais tópicos. Evolução já assinada guarda os rótulos como estavam na
          assinatura — mudar um modelo nunca reescreve prontuário.
        </p>
      </div>

      <EvolutionTemplateManager
        templates={templates}
        specialties={specialties}
        currentProfessionalId={session.user.id}
        canManageOwn={canManageOwn}
        canManageShared={canManageShared}
      />
    </div>
  );
}
