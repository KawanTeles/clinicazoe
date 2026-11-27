import { describe, expect, it } from "vitest";
import { maskForAI, maskKnownName, maskKnownValues, maskStructuredIdentifiers } from "./pii-masking";

describe("maskKnownName", () => {
  it("mascara nome completo e primeiro nome isolado", () => {
    const text = "Maria Silva chegou atrasada. Maria estava calma.";
    expect(maskKnownName(text, "Maria Silva", "[paciente]")).toBe("[paciente] chegou atrasada. [paciente] estava calma.");
  });

  it("não mascara nome vazio/nulo", () => {
    expect(maskKnownName("texto qualquer", null, "[paciente]")).toBe("texto qualquer");
    expect(maskKnownName("texto qualquer", "   ", "[paciente]")).toBe("texto qualquer");
  });

  it("não mascara primeiro nome com menos de 3 letras isoladamente (evita falso positivo)", () => {
    // "Jo" como primeiro nome não deveria arrancar a palavra "jogo" do texto.
    const masked = maskKnownName("Jogo de bola no pátio.", "Jo Pereira", "[paciente]");
    expect(masked).toBe("Jogo de bola no pátio.");
  });
});

describe("maskKnownValues", () => {
  it("mascara valores exatos cadastrados (CPF, telefone, e-mail)", () => {
    const text = "CPF 123.456.789-00, fone (11) 91234-5678, email joao@example.com";
    const masked = maskKnownValues(text, [
      { value: "123.456.789-00", placeholder: "[cpf]" },
      { value: "(11) 91234-5678", placeholder: "[telefone]" },
      { value: "joao@example.com", placeholder: "[e-mail]" },
    ]);
    expect(masked).toBe("CPF [cpf], fone [telefone], email [e-mail]");
  });

  it("ignora valores vazios/nulos sem quebrar", () => {
    const masked = maskKnownValues("texto normal", [
      { value: null, placeholder: "[cpf]" },
      { value: undefined, placeholder: "[telefone]" },
      { value: "", placeholder: "[e-mail]" },
    ]);
    expect(masked).toBe("texto normal");
  });
});

describe("maskStructuredIdentifiers", () => {
  it("mascara e-mail", () => {
    expect(maskStructuredIdentifiers("contato: joao.silva@clinica.com.br")).toBe("contato: [e-mail]");
  });

  it("mascara CPF formatado e não formatado", () => {
    expect(maskStructuredIdentifiers("CPF 123.456.789-00")).toBe("CPF [cpf]");
    expect(maskStructuredIdentifiers("CPF 12345678900")).toBe("CPF [cpf]");
  });

  it("mascara CEP", () => {
    expect(maskStructuredIdentifiers("mora no CEP 01310-100")).toBe("mora no CEP [cep]");
  });

  it("mascara telefone com DDD", () => {
    expect(maskStructuredIdentifiers("ligar em (11) 91234-5678")).toBe("ligar em [telefone]");
  });

  it("mascara datas em formatos comuns (inclui data de nascimento)", () => {
    expect(maskStructuredIdentifiers("nasceu em 15/03/2015")).toBe("nasceu em [data]");
    expect(maskStructuredIdentifiers("sessão de 01-02-2024")).toBe("sessão de [data]");
  });

  it("mascara sequência numérica longa remanescente como fallback (carteirinha/RG)", () => {
    expect(maskStructuredIdentifiers("carteirinha 987654321012")).toBe("carteirinha [identificador]");
  });

  it("não mascara números curtos do dia a dia clínico (contagem de sessões, idade)", () => {
    expect(maskStructuredIdentifiers("paciente tem 8 anos, 3ª sessão do mês")).toBe(
      "paciente tem 8 anos, 3ª sessão do mês",
    );
  });
});

describe("maskForAI — composição completa usada nas actions de IA", () => {
  it("mascara nome do paciente, do profissional e identificadores estruturados juntos", () => {
    const text =
      "Paciente João Souza, atendido pela Dra. Ana Lima. Telefone (11) 98888-7777, nasceu em 10/05/2016.";
    const masked = maskForAI(text, { patientName: "João Souza", professionalName: "Ana Lima" });
    expect(masked).not.toContain("João");
    expect(masked).not.toContain("Ana Lima");
    expect(masked).toContain("[paciente]");
    expect(masked).toContain("[profissional]");
    expect(masked).toContain("[telefone]");
    expect(masked).toContain("[data]");
  });

  it("prioriza valor exato do cadastro sobre o catch-all genérico", () => {
    const text = "Carteirinha do convênio: 55566677788";
    const masked = maskForAI(text, { insuranceCardNumber: "55566677788" });
    expect(masked).toBe("Carteirinha do convênio: [carteirinha]");
  });

  it("mascara nome do responsável quando disponível", () => {
    const text = "A mãe, Patrícia Nunes, relatou melhora no sono.";
    const masked = maskForAI(text, { guardianName: "Patrícia Nunes" });
    expect(masked).toBe("A mãe, [responsável], relatou melhora no sono.");
  });

  it("não falha e não altera o texto quando nenhum identificador é fornecido", () => {
    const text = "Sessão tranquila, sem intercorrências.";
    expect(maskForAI(text)).toBe(text);
  });
});
