import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTherapeuticProgramById, getDataSessionsForProgram } from "@/modules/programs/services/program-queries";
import { evaluateMasteryCriteria } from "@/lib/mastery-criteria";
import { getClinicSettings, getClinicLogoUrl } from "@/modules/settings/services/settings-queries";
import { buildFullAddress, buildShortAddress } from "@/modules/settings/utils/address";
import { ProgramPdfDocument } from "@/modules/programs/components/ProgramPdfDocument";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

const CRITERIA_TYPE_LABELS: Record<string, string> = {
  percentage_independent: "% de respostas independentes",
  consecutive_correct_count: "Contagem de respostas independentes",
};

/** Mesmo padrão de /api/reports/[id]/pdf: RLS (therapeutic_programs_select,
 * program_data_sessions_select) é quem decide se a linha aparece — recepção/
 * admin/coordenação não têm policy de select em nenhuma das duas tabelas
 * (programa é conteúdo clínico), então para eles getTherapeuticProgramById
 * devolve null mesmo sem checagem explícita de role aqui. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Acesso negado." }, { status: 401 });

  const { id } = await params;
  const [program, clinic] = await Promise.all([getTherapeuticProgramById(id), getClinicSettings()]);
  if (!program) return NextResponse.json({ error: "Programa não encontrado." }, { status: 404 });

  const sessions = await getDataSessionsForProgram(id);

  const supabase = await createClient();
  const [{ data: patientProfile }, { data: professionalProfile }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", program.patientId).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", program.professionalId).maybeSingle(),
  ]);

  const masteryMet =
    program.masteryCriteriaType != null && program.masteryCriteriaThreshold != null && program.masteryCriteriaConsecutiveSessions != null
      ? evaluateMasteryCriteria(sessions, {
          type: program.masteryCriteriaType,
          threshold: program.masteryCriteriaThreshold,
          consecutiveSessions: program.masteryCriteriaConsecutiveSessions,
        }).met
      : false;

  const structuredCriteriaLabel =
    program.masteryCriteriaType != null && program.masteryCriteriaThreshold != null && program.masteryCriteriaConsecutiveSessions != null
      ? `${CRITERIA_TYPE_LABELS[program.masteryCriteriaType]} ≥ ${program.masteryCriteriaThreshold}${program.masteryCriteriaType === "percentage_independent" ? "%" : ""} em ${program.masteryCriteriaConsecutiveSessions} sessões consecutivas`
      : null;

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
    <ProgramPdfDocument
      clinicName={clinicName}
      clinicLegalName={clinicLegalName}
      clinicLogoUrl={logoUrl}
      headerContactLine={headerContactLine}
      footerContactLine={footerContactLine}
      programName={program.name}
      programDescription={program.description}
      patientName={patientProfile?.full_name ?? "Paciente"}
      professionalName={professionalProfile?.full_name ?? "Profissional"}
      masteryCriteriaText={program.masteryCriteria}
      structuredCriteriaLabel={structuredCriteriaLabel}
      masteryMet={masteryMet}
      sessions={sessions}
      generatedAt={dateFormatter.format(new Date())}
    />,
  );

  const fileName = `${program.name.replace(/[^\w\-]+/g, "_") || "programa"}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
