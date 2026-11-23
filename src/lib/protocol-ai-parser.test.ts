import { describe, expect, it } from "vitest";
import { parseProtocolAiResponse } from "./protocol-ai-parser";

describe("parseProtocolAiResponse", () => {
  it("parseia linhas domínio,item no formato pedido à IA", () => {
    const text = "Linguagem, Aponta para objetos de interesse\nMotor, Sobe escada alternando os pés";
    expect(parseProtocolAiResponse(text)).toEqual([
      { domain: "Linguagem", label: "Aponta para objetos de interesse" },
      { domain: "Motor", label: "Sobe escada alternando os pés" },
    ]);
  });

  it("aceita item sem domínio (vírgula inicial vazia)", () => {
    const text = ", Observa o próprio nome quando chamado";
    expect(parseProtocolAiResponse(text)).toEqual([{ domain: null, label: "Observa o próprio nome quando chamado" }]);
  });

  it("ignora linhas vazias e espaços nas pontas", () => {
    const text = "\n\nLinguagem, Item A\n   \nMotor, Item B\n";
    expect(parseProtocolAiResponse(text)).toHaveLength(2);
  });

  it("remove aspas ao redor do texto do item, se a IA incluir por conta própria", () => {
    const text = 'Linguagem, "Aponta para objetos de interesse"';
    expect(parseProtocolAiResponse(text)[0].label).toBe("Aponta para objetos de interesse");
  });

  it("devolve lista vazia para texto vazio ou sem itens válidos", () => {
    expect(parseProtocolAiResponse("")).toEqual([]);
    expect(parseProtocolAiResponse("   \n  \n")).toEqual([]);
  });

  it("trata linha sem vírgula como item sem domínio", () => {
    expect(parseProtocolAiResponse("Item sem domínio nem vírgula")).toEqual([
      { domain: null, label: "Item sem domínio nem vírgula" },
    ]);
  });
});
