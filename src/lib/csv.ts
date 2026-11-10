/** Parser de CSV mínimo, sem dependência externa — suficiente pra planilhas
 * simples (sem fórmulas, sem múltiplas abas) exportadas do Excel/Google
 * Sheets. Detecta automaticamente "," ou ";" como separador (Excel em
 * português costuma exportar com ";", já que "," é o separador decimal) e
 * lida com campos entre aspas (inclusive aspas escapadas e vírgulas/ponto-e-
 * vírgula dentro do campo).
 */
export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

function detectDelimiter(headerLine: string): "," | ";" {
  const commaCount = headerLine.split(",").length;
  const semicolonCount = headerLine.split(";").length;
  return semicolonCount > commaCount ? ";" : ",";
}

function parseLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === delimiter) {
      fields.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  fields.push(current.trim());
  return fields;
}

export function parseCsv(text: string): ParsedCsv {
  // Remove BOM (Excel no Windows costuma gravar UTF-8 com BOM) e normaliza quebras de linha.
  const normalized = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseLine(lines[0], delimiter).map((h) => h.trim().toLowerCase());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i], delimiter);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] ?? "").trim();
    });
    rows.push(row);
  }

  return { headers, rows };
}
