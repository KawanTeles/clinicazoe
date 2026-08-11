import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 72, paddingHorizontal: 48, fontSize: 11, color: "#1a1a1a" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingBottom: 12,
    marginBottom: 24,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  logo: { width: 28, height: 28, marginRight: 8, objectFit: "contain" },
  clinicName: { fontSize: 14, fontWeight: 700 },
  generatedAt: { fontSize: 9, color: "#6b7280" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  patient: { fontSize: 10, color: "#4b5563", marginBottom: 20 },
  content: { fontSize: 11, lineHeight: 1.6 },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    paddingTop: 8,
    fontSize: 8,
    color: "#6b7280",
  },
});

interface ReportPdfDocumentProps {
  clinicName: string;
  clinicLogoUrl: string | null;
  title: string;
  patientName: string;
  professionalName: string;
  content: string;
  generatedAt: string;
}

/** Mesmo conteúdo/aviso da página de impressão (/reports/[id]/print), só
 * que renderizado como PDF de verdade no servidor (@react-pdf/renderer),
 * em vez de depender do "Salvar como PDF" do navegador do usuário. */
export function ReportPdfDocument({
  clinicName,
  clinicLogoUrl,
  title,
  patientName,
  professionalName,
  content,
  generatedAt,
}: ReportPdfDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {clinicLogoUrl && <Image src={clinicLogoUrl} style={styles.logo} />}
            <Text style={styles.clinicName}>{clinicName}</Text>
          </View>
          <Text style={styles.generatedAt}>Gerado em {generatedAt}</Text>
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.patient}>Paciente: {patientName}</Text>

        <Text style={styles.content}>{content}</Text>

        <Text style={styles.footer}>
          Este conteúdo foi gerado com auxílio de Inteligência Artificial e foi revisado e validado pelo profissional
          responsável ({professionalName}) antes de sua utilização.
        </Text>
      </Page>
    </Document>
  );
}
