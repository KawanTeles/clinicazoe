/**
 * Mascaramento de identificadores antes de qualquer texto sair para um
 * provedor de IA externo (OpenAI/Anthropic/Gemini). Roda só na cópia que vai
 * para a chamada de IA — nunca no texto original digitado pelo profissional,
 * que continua intacto no prontuário (evolução, relatório, rascunho).
 *
 * É "melhor esforço", não uma garantia: regex não entende contexto, então
 * nomes incomuns, apelidos, ou formatos atípicos de telefone/CEP/data podem
 * escapar. Por isso a tela continua orientando o profissional a evitar
 * digitar identificadores desnecessários — isto aqui é uma camada extra,
 * não substitui esse cuidado.
 *
 * Sem "server-only": são funções puras, sem acesso a banco, reaproveitadas
 * em testes unitários.
 */

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Mascara um nome conhecido (nome completo e primeiro nome isoladamente,
 * com limite de palavra) por um placeholder fixo. Primeiro nome só é
 * mascarado isoladamente a partir de 3 letras, para não sumir com palavras
 * comuns curtas que coincidam com um primeiro nome genérico. */
export function maskKnownName(text: string, fullName: string | null | undefined, placeholder: string): string {
  const trimmed = fullName?.trim();
  if (!trimmed) return text;

  let masked = text.replace(new RegExp(escapeRegExp(trimmed), "gi"), placeholder);

  const firstName = trimmed.split(/\s+/)[0];
  if (firstName && firstName.length >= 3) {
    masked = masked.replace(new RegExp(`(?<![\\p{L}])${escapeRegExp(firstName)}(?![\\p{L}])`, "giu"), placeholder);
  }

  return masked;
}

export interface KnownValueMask {
  /** Valor exato já cadastrado (CPF, telefone, e-mail, nº de carteirinha...).
   * Ignorado silenciosamente se vazio/nulo. */
  value: string | null | undefined;
  placeholder: string;
}

/** Mascara uma lista de valores conhecidos e exatos (vindos do cadastro do
 * paciente) por correspondência literal — mais preciso que regex genérica
 * porque usa o dado real, não um formato aproximado. */
export function maskKnownValues(text: string, identities: KnownValueMask[]): string {
  return identities.reduce((acc, { value, placeholder }) => {
    const trimmed = value?.toString().trim();
    if (!trimmed) return acc;
    return acc.replace(new RegExp(escapeRegExp(trimmed), "gi"), placeholder);
  }, text);
}

/**
 * Mascara formatos estruturados comuns que não dependem de saber o valor de
 * antemão — cobre identificadores digitados pelo profissional que não estão
 * (ou não estão mais) no cadastro do paciente. Ordem importa: dos padrões
 * mais específicos para o catch-all genérico, para que o catch-all só pegue
 * o que sobrar.
 */
export function maskStructuredIdentifiers(text: string): string {
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[e-mail]")
    // CPF: 11 dígitos, com ou sem pontuação (xxx.xxx.xxx-xx). (?<!\d)/(?!\d)
    // em vez de \b: \b não separa dígito de dígito, então sem isso o padrão
    // "casava" um trecho de 11 dígitos DENTRO de uma sequência mais longa
    // (ex.: um nº de carteirinha de 12 dígitos), mascarando só parte dela.
    .replace(/(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g, "[cpf]")
    // CEP: 8 dígitos (xxxxx-xxx)
    .replace(/(?<!\d)\d{5}-?\d{3}(?!\d)/g, "[cep]")
    // Telefone BR: com DDD entre parênteses opcional, separado por espaço/traço
    .replace(/(?<!\d)\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}(?!\d)/g, "[telefone]")
    // Datas dd/mm/aaaa, dd-mm-aaaa, dd.mm.aaaa — cobre data de nascimento
    .replace(/(?<!\d)\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}(?!\d)/g, "[data]")
    // Catch-all: qualquer sequência numérica longa remanescente (RG, nº de
    // carteirinha de convênio, prontuário externo etc.) que os padrões acima
    // não tenham capturado — roda por último, só pega o que sobrou.
    .replace(/\b\d[\d.\s-]{6,}\d\b/g, "[identificador]");
}

export interface PatientIdentityForMasking {
  patientName?: string | null;
  professionalName?: string | null;
  guardianName?: string | null;
  cpf?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  insuranceCardNumber?: string | null;
}

/** Função única usada por toda chamada de IA que lida com texto de paciente:
 * nomes conhecidos primeiro (paciente, profissional, responsável), depois os
 * valores exatos do cadastro (CPF, telefone, e-mail, endereço, carteirinha),
 * e por fim o catch-all de formatos estruturados para o que não estiver
 * cadastrado (datas, identificadores digitados à mão, etc.). */
export function maskForAI(text: string, identity: PatientIdentityForMasking = {}): string {
  let masked = text;
  masked = maskKnownName(masked, identity.patientName, "[paciente]");
  masked = maskKnownName(masked, identity.professionalName, "[profissional]");
  masked = maskKnownName(masked, identity.guardianName, "[responsável]");
  masked = maskKnownValues(masked, [
    { value: identity.cpf, placeholder: "[cpf]" },
    { value: identity.phone, placeholder: "[telefone]" },
    { value: identity.email, placeholder: "[e-mail]" },
    { value: identity.address, placeholder: "[endereço]" },
    { value: identity.insuranceCardNumber, placeholder: "[carteirinha]" },
  ]);
  masked = maskStructuredIdentifiers(masked);
  return masked;
}
