import { Document, Page, Text, View, Image, StyleSheet, Svg, Line, Path, Circle } from "@react-pdf/renderer";
import type { ProgramDataSessionView } from "@/modules/programs/services/program-queries";

const styles = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 64, paddingHorizontal: 48, fontSize: 11, color: "#1a1a1a" },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingBottom: 10,
    marginBottom: 24,
  },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  logo: { width: 32, height: 32, marginRight: 10, objectFit: "contain" },
  clinicName: { fontSize: 15, fontWeight: 700, color: "#111827" },
  clinicLegalName: { fontSize: 8, color: "#9ca3af", marginTop: 1 },
  generatedAt: { fontSize: 9, color: "#6b7280" },
  headerContact: { fontSize: 8, color: "#6b7280", marginTop: 8 },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4, color: "#111827" },
  subtitle: { fontSize: 10, color: "#4b5563", marginBottom: 2 },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: "#111827", marginTop: 18, marginBottom: 6 },
  masteryBanner: {
    marginTop: 10,
    padding: 8,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#6ee7b7",
    borderRadius: 4,
  },
  masteryText: { fontSize: 10, fontWeight: 700, color: "#047857" },
  table: { marginTop: 4 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: "#f3f4f6", paddingVertical: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingVertical: 4 },
  tableCellDate: { width: "16%", fontSize: 9, paddingHorizontal: 3 },
  tableCellCount: { width: "14%", fontSize: 9, paddingHorizontal: 3, textAlign: "center" },
  tableCellNotes: { width: "16%", fontSize: 8, paddingHorizontal: 3, color: "#4b5563" },
  tableHeaderText: { fontSize: 8, fontWeight: 700, color: "#374151" },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    paddingTop: 8,
  },
  footerContactRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerContact: { fontSize: 8, color: "#9ca3af", flexGrow: 1, flexShrink: 1, marginRight: 12 },
  footerPage: { fontSize: 8, color: "#9ca3af" },
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

function independencePercent(session: ProgramDataSessionView): number {
  const total =
    session.independentCount +
    session.verbalPromptCount +
    session.gesturalPromptCount +
    session.physicalPromptCount +
    session.incorrectCount;
  return total === 0 ? 0 : Math.round((session.independentCount / total) * 100);
}

/** Mesmo desenho matemático de ProgramDataChart.tsx (SVG à mão), só que com
 * os primitivos de @react-pdf/renderer em vez de SVG de navegador — não dá
 * pra reaproveitar o componente web direto dentro de um PDF renderizado no
 * servidor. */
function ChartSvg({ sessions }: { sessions: ProgramDataSessionView[] }) {
  const WIDTH = 500;
  const HEIGHT = 160;
  const PADDING_BOTTOM = 22;
  const PADDING_TOP = 16;
  const PADDING_X = 12;

  const chartWidth = WIDTH - PADDING_X * 2;
  const chartHeight = HEIGHT - PADDING_BOTTOM - PADDING_TOP;

  const points = sessions.map((session, index) => {
    const x = sessions.length === 1 ? PADDING_X + chartWidth / 2 : PADDING_X + (index / (sessions.length - 1)) * chartWidth;
    const pct = independencePercent(session);
    const y = PADDING_TOP + chartHeight - (pct / 100) * chartHeight;
    return { x, y, pct, date: session.sessionDate };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <Svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
      {[0, 25, 50, 75, 100].map((tick) => {
        const y = PADDING_TOP + chartHeight - (tick / 100) * chartHeight;
        return <Line key={tick} x1={PADDING_X} y1={y} x2={WIDTH - PADDING_X} y2={y} stroke="#e5e7eb" strokeWidth={1} />;
      })}
      <Path d={linePath} stroke="#4f46e5" strokeWidth={2} fill="none" />
      {points.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#4f46e5" />
      ))}
    </Svg>
  );
}

interface ProgramPdfDocumentProps {
  clinicName: string;
  clinicLegalName: string | null;
  clinicLogoUrl: string | null;
  headerContactLine: string | null;
  footerContactLine: string | null;
  programName: string;
  programDescription: string | null;
  patientName: string;
  professionalName: string;
  masteryCriteriaText: string | null;
  structuredCriteriaLabel: string | null;
  masteryMet: boolean;
  sessions: ProgramDataSessionView[];
  generatedAt: string;
}

/** Devolutiva de programa terapêutico (ABA) pra família/convênio — mesmo
 * cabeçalho/rodapé com identidade da clínica do relatório de IA
 * (ReportPdfDocument), com o gráfico de % de independência e a tabela de
 * sessões no lugar do texto corrido. */
export function ProgramPdfDocument({
  clinicName,
  clinicLegalName,
  clinicLogoUrl,
  headerContactLine,
  footerContactLine,
  programName,
  programDescription,
  patientName,
  professionalName,
  masteryCriteriaText,
  structuredCriteriaLabel,
  masteryMet,
  sessions,
  generatedAt,
}: ProgramPdfDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              {clinicLogoUrl && <Image src={clinicLogoUrl} style={styles.logo} />}
              <View>
                <Text style={styles.clinicName}>{clinicName}</Text>
                {clinicLegalName && <Text style={styles.clinicLegalName}>{clinicLegalName}</Text>}
              </View>
            </View>
            <Text style={styles.generatedAt}>Gerado em {generatedAt}</Text>
          </View>
          {headerContactLine && <Text style={styles.headerContact}>{headerContactLine}</Text>}
        </View>

        <Text style={styles.title}>Programa Terapêutico (ABA) — Relatório de Evolução</Text>
        <Text style={styles.subtitle}>Paciente: {patientName}</Text>
        <Text style={styles.subtitle}>Profissional responsável: {professionalName}</Text>
        <Text style={styles.subtitle}>Programa: {programName}</Text>
        {programDescription && <Text style={styles.subtitle}>Alvo: {programDescription}</Text>}
        {masteryCriteriaText && <Text style={styles.subtitle}>Observação sobre o critério: {masteryCriteriaText}</Text>}
        {structuredCriteriaLabel && <Text style={styles.subtitle}>Critério de domínio: {structuredCriteriaLabel}</Text>}

        {masteryMet && (
          <View style={styles.masteryBanner}>
            <Text style={styles.masteryText}>Critério de domínio atingido nas sessões mais recentes.</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Evolução — % de respostas independentes por sessão</Text>
        {sessions.length > 0 ? (
          <ChartSvg sessions={sessions} />
        ) : (
          <Text style={styles.subtitle}>Nenhuma sessão registrada ainda.</Text>
        )}

        <Text style={styles.sectionTitle}>Sessões registradas</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableCellDate, styles.tableHeaderText]}>Data</Text>
            <Text style={[styles.tableCellCount, styles.tableHeaderText]}>Independente</Text>
            <Text style={[styles.tableCellCount, styles.tableHeaderText]}>Dica verbal</Text>
            <Text style={[styles.tableCellCount, styles.tableHeaderText]}>Dica gestual</Text>
            <Text style={[styles.tableCellCount, styles.tableHeaderText]}>Dica física</Text>
            <Text style={[styles.tableCellCount, styles.tableHeaderText]}>Incorreta</Text>
            <Text style={[styles.tableCellNotes, styles.tableHeaderText]}>Nota</Text>
          </View>
          {sessions.map((s) => (
            <View key={s.id} style={styles.tableRow}>
              <Text style={styles.tableCellDate}>{dateFormatter.format(new Date(`${s.sessionDate}T00:00:00`))}</Text>
              <Text style={styles.tableCellCount}>{s.independentCount}</Text>
              <Text style={styles.tableCellCount}>{s.verbalPromptCount}</Text>
              <Text style={styles.tableCellCount}>{s.gesturalPromptCount}</Text>
              <Text style={styles.tableCellCount}>{s.physicalPromptCount}</Text>
              <Text style={styles.tableCellCount}>{s.incorrectCount}</Text>
              <Text style={styles.tableCellNotes}>{s.notes || "—"}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <View style={styles.footerContactRow}>
            {footerContactLine && <Text style={styles.footerContact}>{footerContactLine}</Text>}
            <Text
              style={styles.footerPage}
              render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
            />
          </View>
        </View>
      </Page>
    </Document>
  );
}
