import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

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
  patient: { fontSize: 10, color: "#4b5563", marginBottom: 20 },
  content: { fontSize: 11, lineHeight: 1.65 },
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

interface ReportPdfDocumentProps {
  clinicName: string;
  /** Razão social — só é exibida quando preenchida e diferente do nome fantasia. */
  clinicLegalName: string | null;
  clinicLogoUrl: string | null;
  /** Endereço completo + telefone, já formatados, exibidos abaixo do nome da clínica no cabeçalho. */
  headerContactLine: string | null;
  /** Nome da clínica + telefone + endereço resumido, repetidos no rodapé de toda página. */
  footerContactLine: string | null;
  title: string;
  patientName: string;
  content: string;
  generatedAt: string;
}

/** Mesmo conteúdo/aviso da página de impressão (/reports/[id]/print), só
 * que renderizado como PDF de verdade no servidor (@react-pdf/renderer),
 * em vez de depender do "Salvar como PDF" do navegador do usuário.
 * Cabeçalho e rodapé usam `fixed` para se repetirem em papel timbrado em
 * toda página, inclusive em relatórios longos com múltiplas páginas. */
export function ReportPdfDocument({
  clinicName,
  clinicLegalName,
  clinicLogoUrl,
  headerContactLine,
  footerContactLine,
  title,
  patientName,
  content,
  generatedAt,
}: ReportPdfDocumentProps) {
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

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.patient}>Paciente: {patientName}</Text>

        <Text style={styles.content}>{content}</Text>

        <View style={styles.footer} fixed>
          <View style={styles.footerContactRow}>
            <Text style={styles.footerContact}>{footerContactLine}</Text>
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
