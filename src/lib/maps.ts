interface MapsSource {
  mapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
}

/**
 * Monta a URL para "Ver no Google Maps" (abre em nova aba). Prioridade:
 * link explícito cadastrado > coordenadas > endereço em texto (geocoding
 * textual do próprio Google, fallback técnico quando nada mais foi informado).
 */
export function buildMapsViewUrl({ mapsUrl, latitude, longitude, address }: MapsSource): string | null {
  if (mapsUrl?.trim()) return mapsUrl.trim();
  if (latitude != null && longitude != null) {
    return `https://maps.google.com/?q=${latitude},${longitude}`;
  }
  if (address?.trim()) {
    return `https://maps.google.com/?q=${encodeURIComponent(address.trim())}`;
  }
  return null;
}

/**
 * Monta a URL de embed usada no <iframe> do mapa. Links de "compartilhar"
 * do Google Maps não são embutíveis diretamente (formato opaco), por isso
 * um `mapsUrl` só é usado aqui se já for um link de embed; caso contrário
 * caímos para coordenadas ou endereço em texto, na mesma prioridade do
 * `buildMapsViewUrl`.
 */
export function buildMapsEmbedUrl({ mapsUrl, latitude, longitude, address }: MapsSource): string | null {
  if (mapsUrl?.trim() && /[?&]output=embed|\/embed/.test(mapsUrl)) {
    return mapsUrl.trim();
  }
  if (latitude != null && longitude != null) {
    return `https://www.google.com/maps?q=${latitude},${longitude}&output=embed`;
  }
  if (address?.trim()) {
    return `https://www.google.com/maps?q=${encodeURIComponent(address.trim())}&output=embed`;
  }
  return null;
}
