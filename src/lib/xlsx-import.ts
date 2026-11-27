/**
 * Helpers puros (sem acesso a DOM/arquivo) para o mapeamento de colunas da
 * importação por .xlsx — extraídos de ImportAppointmentsPanel.tsx pra poder
 * testar sem precisar simular upload de arquivo. A leitura do arquivo em si
 * (read-excel-file) continua só no componente, que é quem tem o `File`.
 */

export type XlsxCellValue = string | number | boolean | Date | null;

/** Nomes dos campos aceitos pela importação — mesmos nomes de coluna do CSV
 * (ImportRowInput, import-actions.ts), usados aqui como chave do mapeamento
 * de colunas da planilha .xlsx. */
export const IMPORT_FIELD_KEYS = [
  "telefone_paciente",
  "profissional",
  "data",
  "hora",
  "duracao_minutos",
  "convenio",
  "modalidade",
  "produto_particular",
  "forma_pagamento",
  "valor",
  "pago",
  "status",
  "observacoes",
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELD_KEYS)[number];

export const REQUIRED_IMPORT_FIELDS: ImportFieldKey[] = ["telefone_paciente", "profissional", "data", "hora"];

export const IMPORT_FIELD_LABELS: Record<ImportFieldKey, string> = {
  telefone_paciente: "Telefone do paciente",
  profissional: "Profissional",
  data: "Data",
  hora: "Hora",
  duracao_minutos: "Duração (minutos)",
  convenio: "Convênio",
  modalidade: "Modalidade (aba/comum)",
  produto_particular: "Produto particular",
  forma_pagamento: "Forma de pagamento",
  valor: "Valor",
  pago: "Pago (sim/não)",
  status: "Status",
  observacoes: "Observações",
};

/** Letras de coluna (A, B, ..., Z, AA, AB, ...) pro rótulo do seletor —
 * mesma convenção visual de uma planilha, pra quem está mapeando reconhecer
 * a coluna mais fácil que só pelo índice numérico. */
export function columnLetter(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/** Converte uma célula da planilha para o mesmo formato de texto que o CSV
 * já entrega (ImportRowInput — tudo string). Datas/horas digitadas como
 * valor de data/hora reais do Excel chegam aqui como objeto `Date` (a
 * biblioteca de leitura detecta pelo formato de número da célula); texto
 * puro chega como string e passa direto. */
export function cellToImportString(value: XlsxCellValue, kind: "date" | "time" | "text" = "text"): string {
  if (value == null) return "";

  if (value instanceof Date) {
    if (kind === "time") {
      const hh = String(value.getHours()).padStart(2, "0");
      const mm = String(value.getMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    }
    const dd = String(value.getDate()).padStart(2, "0");
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const yyyy = value.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  if (typeof value === "boolean") return value ? "sim" : "nao";

  return String(value).trim();
}

const CELL_KIND_BY_FIELD: Partial<Record<ImportFieldKey, "date" | "time">> = {
  data: "date",
  hora: "time",
};

/** Tenta mapear automaticamente as colunas cujo cabeçalho já bate (igual,
 * sem diferenciar maiúsculas/espaços nas pontas) com o nome esperado pelo
 * CSV — cobre o caso comum de alguém exportar a mesma planilha usada no
 * import por CSV, sem precisar mapear tudo à mão. Não tenta sinônimos
 * (ex.: "telefone" sem "_paciente"): ambíguo demais pra adivinhar sem
 * confirmação, melhor deixar em branco pro usuário escolher. */
export function guessColumnMapping(headerRow: XlsxCellValue[]): Partial<Record<ImportFieldKey, number>> {
  const mapping: Partial<Record<ImportFieldKey, number>> = {};
  const normalizedHeaders = headerRow.map((cell) => cellToImportString(cell).toLowerCase().trim());

  for (const field of IMPORT_FIELD_KEYS) {
    const index = normalizedHeaders.indexOf(field);
    if (index !== -1) mapping[field] = index;
  }

  return mapping;
}

export interface MappedImportRow {
  rowNumber: number;
  values: Record<ImportFieldKey, string>;
}

/** Aplica o mapeamento de colunas escolhido às linhas de dados (já sem a
 * linha de cabeçalho) — devolve no mesmo formato que o parser de CSV monta
 * pra cada linha, pra alimentar previewImportRows sem nenhuma lógica nova
 * no servidor. `rowNumber` conta a partir de 2 igual ao CSV (linha 1 é
 * cabeçalho). */
export function mapXlsxRows(
  dataRows: XlsxCellValue[][],
  columnMap: Partial<Record<ImportFieldKey, number>>,
): MappedImportRow[] {
  return dataRows.map((row, rowIndex) => {
    const values = {} as Record<ImportFieldKey, string>;
    for (const field of IMPORT_FIELD_KEYS) {
      const columnIndex = columnMap[field];
      const cell = columnIndex != null ? row[columnIndex] ?? null : null;
      values[field] = cellToImportString(cell, CELL_KIND_BY_FIELD[field]);
    }
    return { rowNumber: rowIndex + 2, values };
  });
}

/** Linhas totalmente vazias (todas as colunas mapeadas em branco) — comum
 * no final de planilhas exportadas, com linhas sobrando depois da última
 * com dado real. Filtradas antes de chegar no preview, pra não aparecerem
 * como erro de "telefone não informado" sem nenhum dado de verdade. */
export function isBlankMappedRow(row: MappedImportRow): boolean {
  return Object.values(row.values).every((v) => v.trim() === "");
}
