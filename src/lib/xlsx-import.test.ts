import { describe, expect, it } from "vitest";
import {
  cellToImportString,
  columnLetter,
  guessColumnMapping,
  isBlankMappedRow,
  mapXlsxRows,
} from "./xlsx-import";

describe("columnLetter", () => {
  it("converte índices nas primeiras letras", () => {
    expect(columnLetter(0)).toBe("A");
    expect(columnLetter(1)).toBe("B");
    expect(columnLetter(25)).toBe("Z");
  });

  it("converte índices acima de Z para letras duplas", () => {
    expect(columnLetter(26)).toBe("AA");
    expect(columnLetter(27)).toBe("AB");
    expect(columnLetter(51)).toBe("AZ");
    expect(columnLetter(52)).toBe("BA");
  });
});

describe("cellToImportString", () => {
  it("mantém texto e número como string, sem conversão de data/hora", () => {
    expect(cellToImportString("João")).toBe("João");
    expect(cellToImportString(150)).toBe("150");
    expect(cellToImportString(null)).toBe("");
  });

  it("converte boolean para sim/não (célula tipo checkbox)", () => {
    expect(cellToImportString(true)).toBe("sim");
    expect(cellToImportString(false)).toBe("nao");
  });

  it("formata Date como DD/MM/AAAA quando kind='date'", () => {
    const date = new Date(2026, 2, 5); // 5 de março de 2026
    expect(cellToImportString(date, "date")).toBe("05/03/2026");
  });

  it("formata Date como HH:MM quando kind='time', ignorando a data (época arbitrária do Excel)", () => {
    const time = new Date(1899, 11, 30, 14, 30);
    expect(cellToImportString(time, "time")).toBe("14:30");
  });

  it("não falha se um campo de data vier como texto puro (planilha sem formatação de data)", () => {
    expect(cellToImportString("05/03/2026", "date")).toBe("05/03/2026");
  });
});

describe("guessColumnMapping", () => {
  it("mapeia automaticamente cabeçalhos que batem exatamente com o nome esperado", () => {
    const header = ["telefone_paciente", "profissional", "data", "hora", "observacoes"];
    const mapping = guessColumnMapping(header);
    expect(mapping).toEqual({
      telefone_paciente: 0,
      profissional: 1,
      data: 2,
      hora: 3,
      observacoes: 4,
    });
  });

  it("ignora maiúsculas/espaços nas pontas mas não tenta sinônimos", () => {
    const header = [" Telefone_Paciente ", "Terapeuta", "Data "];
    const mapping = guessColumnMapping(header);
    expect(mapping.telefone_paciente).toBe(0);
    // "Terapeuta" não é sinônimo reconhecido de "profissional" — fica de
    // fora do mapeamento automático, o usuário escolhe manualmente.
    expect(mapping.profissional).toBeUndefined();
    expect(mapping.data).toBe(2);
  });

  it("devolve objeto vazio quando nenhum cabeçalho bate", () => {
    expect(guessColumnMapping(["Coluna A", "Coluna B"])).toEqual({});
  });
});

describe("mapXlsxRows", () => {
  it("aplica o mapeamento e numera linhas a partir de 2 (linha 1 é cabeçalho)", () => {
    const dataRows = [
      ["11999998888", "Ana Silva", new Date(2026, 2, 10), new Date(1899, 11, 30, 9, 0)],
      ["11988887777", "Bruno Costa", new Date(2026, 2, 11), new Date(1899, 11, 30, 10, 30)],
    ];
    const columnMap = { telefone_paciente: 0, profissional: 1, data: 2, hora: 3 };
    const mapped = mapXlsxRows(dataRows, columnMap);

    expect(mapped).toHaveLength(2);
    expect(mapped[0]).toEqual({
      rowNumber: 2,
      values: expect.objectContaining({
        telefone_paciente: "11999998888",
        profissional: "Ana Silva",
        data: "10/03/2026",
        hora: "09:00",
      }),
    });
    expect(mapped[1].rowNumber).toBe(3);
  });

  it("preenche com string vazia campos não mapeados", () => {
    const mapped = mapXlsxRows([["11999998888"]], { telefone_paciente: 0 });
    expect(mapped[0].values.profissional).toBe("");
    expect(mapped[0].values.observacoes).toBe("");
  });
});

describe("isBlankMappedRow", () => {
  it("identifica linha totalmente vazia", () => {
    const mapped = mapXlsxRows([[null, "", null]], { telefone_paciente: 0, profissional: 1, data: 2 });
    expect(isBlankMappedRow(mapped[0])).toBe(true);
  });

  it("não marca como vazia se ao menos um campo mapeado tiver valor", () => {
    const mapped = mapXlsxRows([["11999998888", "", null]], { telefone_paciente: 0, profissional: 1, data: 2 });
    expect(isBlankMappedRow(mapped[0])).toBe(false);
  });
});
