import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getActiveConsentTemplate, getConsentTemplateHistory } from "@/modules/evolutions/services/consent-queries";
import { ConsentTemplateManager } from "@/modules/evolutions/components/ConsentTemplateManager";

export const metadata = {
  title: "Termo de consentimento — Espaço Zoe",
};

export default async function ConsentTemplatePage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const canManage = await can(session.profile, "consent_templates.manage");
  if (!canManage) redirect("/dashboard");

  const [template, history] = await Promise.all([getActiveConsentTemplate(), getConsentTemplateHistory()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">
          Termo de consentimento de imagem/áudio
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-text-secondary">
          Texto mostrado ao responsável antes de anexar imagem ou áudio à evolução de um paciente. Publicar uma
          versão nova nunca reescreve termos já assinados — eles continuam provando exatamente o texto que o
          responsável leu na hora.
        </p>
      </div>

      <ConsentTemplateManager currentBody={template?.body ?? null} history={history} />
    </div>
  );
}
