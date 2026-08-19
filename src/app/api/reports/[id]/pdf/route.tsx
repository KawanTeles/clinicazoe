import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getAIFeatureFlags } from "@/modules/ai/services/ai-settings-queries";
import { getAIReport } from "@/modules/ai/services/reports-queries";
import { getClinicSettings, getClinicLogoUrl } from "@/modules/settings/services/settings-queries";
import { buildFullAddress, buildShortAddress } from "@/modules/settings/utils/address";
import { ReportPdfDocument } from "@/modules/ai/components/ReportPdfDocument";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

/** Mesma checagem de permissão e a mesma busca RLS-scoped (getAIReport) que
 * /reports/[id]/print já usa — mudança é só o mecanismo de exportação
 * (PDF real gerado no servidor em vez do "Salvar como PDF" do navegador na
 * página de impressão, que continua existindo sem alterações). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Acesso negado." }, { status: 401 });

  const [canUse, flags] = await Promise.all([can(session.profile.role, "ai.reports.use"), getAIFeatureFlags()]);
  if (!canUse || !flags.enabled || !flags.reportsEnabled) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await params;
  const [report, clinic] = await Promise.all([getAIReport(id), getClinicSettings()]);
  if (!report) return NextResponse.json({ error: "Relatório não encontrado." }, { status: 404 });

  const logoUrl = await getClinicLogoUrl(clinic?.logo_path ?? null);

  const clinicName = clinic?.name ?? "Espaço Zoe";
  const legalName = clinic?.legal_name?.trim() || null;
  const clinicLegalName = legalName && legalName !== clinicName ? legalName : null;

  const phone = clinic?.phone_primary?.trim() || null;
  const fullAddress = clinic ? buildFullAddress(clinic) : null;
  const shortAddress = clinic ? buildShortAddress(clinic) : null;

  const headerContactLine = [fullAddress, phone ? `Tel: ${phone}` : null].filter(Boolean).join("  •  ") || null;
  const footerContactLine =
    [clinicName, phone ? `Tel: ${phone}` : null, shortAddress].filter(Boolean).join("  •  ") || null;

  const buffer = await renderToBuffer(
    <ReportPdfDocument
      clinicName={clinicName}
      clinicLegalName={clinicLegalName}
      clinicLogoUrl={logoUrl}
      headerContactLine={headerContactLine}
      footerContactLine={footerContactLine}
      title={report.title}
      patientName={report.patientName}
      content={report.content}
      generatedAt={dateFormatter.format(new Date(report.createdAt))}
    />,
  );

  const fileName = `${report.title.replace(/[^\w\-]+/g, "_") || "relatorio"}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
