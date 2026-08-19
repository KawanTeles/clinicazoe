export interface AddressParts {
  address_zip?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_country?: string | null;
}

/**
 * Monta a string de endereço completo a partir das partes estruturadas, no
 * padrão "Rua, Número - Complemento - Bairro, Cidade - UF, CEP 00000-000, País".
 * Partes vazias são omitidas sem deixar separadores soltos. Retorna null se
 * nenhuma parte estiver preenchida.
 */
export function buildFullAddress(parts: AddressParts): string | null {
  const street = parts.address_street?.trim();
  const number = parts.address_number?.trim();
  const complement = parts.address_complement?.trim();
  const neighborhood = parts.address_neighborhood?.trim();
  const city = parts.address_city?.trim();
  const state = parts.address_state?.trim();
  const zip = parts.address_zip?.trim();
  const country = parts.address_country?.trim();

  const streetLine = [street, number].filter(Boolean).join(", ");
  const segments: string[] = [];

  if (streetLine) segments.push(streetLine);
  if (complement) segments.push(complement);

  const cityLine = [neighborhood, [city, state].filter(Boolean).join(" - ")]
    .filter(Boolean)
    .join(", ");
  if (cityLine) segments.push(cityLine);

  if (zip) segments.push(`CEP ${zip}`);
  if (country && country.toLowerCase() !== "brasil") segments.push(country);

  if (segments.length === 0) return null;
  return segments.join(" - ");
}

/**
 * Versão resumida do endereço, para espaços compactos (rodapé de PDF, por
 * exemplo): "Rua, Número - Cidade - UF", sem bairro/complemento/CEP/país.
 */
export function buildShortAddress(parts: AddressParts): string | null {
  const street = parts.address_street?.trim();
  const number = parts.address_number?.trim();
  const city = parts.address_city?.trim();
  const state = parts.address_state?.trim();

  const streetLine = [street, number].filter(Boolean).join(", ");
  const cityState = [city, state].filter(Boolean).join(" - ");

  const segments = [streetLine, cityState].filter(Boolean);
  if (segments.length === 0) return null;
  return segments.join(" - ");
}
