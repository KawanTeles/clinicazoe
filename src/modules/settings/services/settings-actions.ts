"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/modules/team/services/audit";
import { buildFullAddress } from "@/modules/settings/utils/address";
import type { BusinessHourEntry } from "@/lib/supabase/types";

const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const PUBLIC_PATHS = [
  "/",
  "/contato",
  "/clinica",
  "/especialidades",
  "/convenios",
  "/profissionais",
  "/estrutura",
  "/equipe",
  "/settings",
];

function revalidatePublicSite() {
  for (const path of PUBLIC_PATHS) revalidatePath(path);
}

function nullIfEmpty(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

type ActionResult = { error: string | null };

export async function updateClinicIdentity(input: {
  name: string;
  legal_name: string;
  email: string;
  website_url: string;
}): Promise<ActionResult> {
  const session = await requireAdmin().catch(() => null);
  if (!session) return { error: "Acesso negado." };

  if (!input.name.trim()) return { error: "Informe o nome da clínica." };
  const email = nullIfEmpty(input.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Informe um e-mail válido." };
  }
  const websiteUrl = nullIfEmpty(input.website_url);
  if (websiteUrl && !isValidUrl(websiteUrl)) {
    return { error: "Informe um site válido (com http:// ou https://)." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("clinic_settings")
    .update({
      name: input.name.trim(),
      legal_name: nullIfEmpty(input.legal_name),
      email,
      website_url: websiteUrl,
    })
    .eq("id", 1);

  if (error) return { error: "Não foi possível salvar a identidade da clínica." };

  await logAudit({ actorId: session.user.id, action: "clinic_settings.identity_updated", entity: "clinic_settings", entityId: "1" });
  revalidatePublicSite();
  return { error: null };
}

export async function updateClinicAddress(input: {
  address_zip: string;
  address_street: string;
  address_number: string;
  address_complement: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  address_country: string;
}): Promise<ActionResult> {
  const session = await requireAdmin().catch(() => null);
  if (!session) return { error: "Acesso negado." };

  const parts = {
    address_zip: nullIfEmpty(input.address_zip),
    address_street: nullIfEmpty(input.address_street),
    address_number: nullIfEmpty(input.address_number),
    address_complement: nullIfEmpty(input.address_complement),
    address_neighborhood: nullIfEmpty(input.address_neighborhood),
    address_city: nullIfEmpty(input.address_city),
    address_state: nullIfEmpty(input.address_state),
    address_country: nullIfEmpty(input.address_country) ?? "Brasil",
  };
  const address = buildFullAddress(parts);

  const supabase = await createClient();
  const { error } = await supabase
    .from("clinic_settings")
    .update({ ...parts, address })
    .eq("id", 1);

  if (error) return { error: "Não foi possível salvar o endereço." };

  await logAudit({ actorId: session.user.id, action: "clinic_settings.address_updated", entity: "clinic_settings", entityId: "1" });
  revalidatePublicSite();
  return { error: null };
}

export async function updateClinicContacts(input: {
  whatsapp_number: string;
  phone_primary: string;
  phone_secondary: string;
  emergency_phone: string;
}): Promise<ActionResult> {
  const session = await requireAdmin().catch(() => null);
  if (!session) return { error: "Acesso negado." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("clinic_settings")
    .update({
      whatsapp_number: nullIfEmpty(input.whatsapp_number),
      phone_primary: nullIfEmpty(input.phone_primary),
      phone_secondary: nullIfEmpty(input.phone_secondary),
      emergency_phone: nullIfEmpty(input.emergency_phone),
    })
    .eq("id", 1);

  if (error) return { error: "Não foi possível salvar os contatos." };

  await logAudit({ actorId: session.user.id, action: "clinic_settings.contacts_updated", entity: "clinic_settings", entityId: "1" });
  revalidatePublicSite();
  return { error: null };
}

function validateBusinessHours(entries: BusinessHourEntry[]): string | null {
  if (!Array.isArray(entries) || entries.length !== 7) return "Configure os 7 dias da semana.";
  const days = new Set(entries.map((e) => e.day));
  if (days.size !== 7 || ![0, 1, 2, 3, 4, 5, 6].every((d) => days.has(d))) {
    return "Dias da semana inválidos.";
  }
  for (const entry of entries) {
    if (!entry.is_open) continue;
    if (!TIME_PATTERN.test(entry.open_time) || !TIME_PATTERN.test(entry.close_time)) {
      return "Informe horários válidos (HH:MM) para os dias ativos.";
    }
    if (entry.open_time >= entry.close_time) {
      return "O horário de abertura deve ser antes do horário de fechamento.";
    }
  }
  return null;
}

export async function updateClinicBusinessHours(input: {
  business_hours: BusinessHourEntry[];
  holiday_open: boolean;
  holiday_open_time: string;
  holiday_close_time: string;
}): Promise<ActionResult> {
  const session = await requireAdmin().catch(() => null);
  if (!session) return { error: "Acesso negado." };

  const hoursError = validateBusinessHours(input.business_hours);
  if (hoursError) return { error: hoursError };

  let holidayOpenTime: string | null = null;
  let holidayCloseTime: string | null = null;
  if (input.holiday_open) {
    if (!TIME_PATTERN.test(input.holiday_open_time) || !TIME_PATTERN.test(input.holiday_close_time)) {
      return { error: "Informe horários válidos (HH:MM) para o funcionamento em feriados." };
    }
    if (input.holiday_open_time >= input.holiday_close_time) {
      return { error: "O horário de abertura em feriados deve ser antes do fechamento." };
    }
    holidayOpenTime = input.holiday_open_time;
    holidayCloseTime = input.holiday_close_time;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("clinic_settings")
    .update({
      business_hours: input.business_hours,
      holiday_open: input.holiday_open,
      holiday_open_time: holidayOpenTime,
      holiday_close_time: holidayCloseTime,
    })
    .eq("id", 1);

  if (error) return { error: "Não foi possível salvar o horário de funcionamento." };

  await logAudit({ actorId: session.user.id, action: "clinic_settings.business_hours_updated", entity: "clinic_settings", entityId: "1" });
  revalidatePublicSite();
  return { error: null };
}

export async function updateClinicSocialMedia(input: {
  instagram_url: string;
  facebook_url: string;
  linkedin_url: string;
  youtube_url: string;
}): Promise<ActionResult> {
  const session = await requireAdmin().catch(() => null);
  if (!session) return { error: "Acesso negado." };

  const urls = {
    instagram_url: nullIfEmpty(input.instagram_url),
    facebook_url: nullIfEmpty(input.facebook_url),
    linkedin_url: nullIfEmpty(input.linkedin_url),
    youtube_url: nullIfEmpty(input.youtube_url),
  };
  for (const value of Object.values(urls)) {
    if (value && !isValidUrl(value)) return { error: "Informe links válidos (com http:// ou https://)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("clinic_settings").update(urls).eq("id", 1);

  if (error) return { error: "Não foi possível salvar as redes sociais." };

  await logAudit({ actorId: session.user.id, action: "clinic_settings.social_media_updated", entity: "clinic_settings", entityId: "1" });
  revalidatePublicSite();
  return { error: null };
}

export async function updateClinicLocation(input: {
  maps_url: string;
  latitude: string;
  longitude: string;
}): Promise<ActionResult> {
  const session = await requireAdmin().catch(() => null);
  if (!session) return { error: "Acesso negado." };

  const mapsUrl = nullIfEmpty(input.maps_url);
  if (mapsUrl && !isValidUrl(mapsUrl)) return { error: "Informe um link do Google Maps válido." };

  const latRaw = input.latitude?.trim();
  const lngRaw = input.longitude?.trim();
  if ((latRaw && !lngRaw) || (!latRaw && lngRaw)) {
    return { error: "Informe latitude e longitude juntas, ou deixe ambas em branco." };
  }

  let latitude: number | null = null;
  let longitude: number | null = null;
  if (latRaw && lngRaw) {
    latitude = Number(latRaw.replace(",", "."));
    longitude = Number(lngRaw.replace(",", "."));
    if (Number.isNaN(latitude) || latitude < -90 || latitude > 90) return { error: "Latitude inválida (-90 a 90)." };
    if (Number.isNaN(longitude) || longitude < -180 || longitude > 180) return { error: "Longitude inválida (-180 a 180)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("clinic_settings").update({ maps_url: mapsUrl, latitude, longitude }).eq("id", 1);

  if (error) return { error: "Não foi possível salvar a localização." };

  await logAudit({ actorId: session.user.id, action: "clinic_settings.location_updated", entity: "clinic_settings", entityId: "1" });
  revalidatePublicSite();
  return { error: null };
}

function parsePositiveOrEmpty(value: string): { ok: true; parsed: number | null } | { ok: false } {
  const trimmed = value?.trim();
  if (!trimmed) return { ok: true, parsed: null };
  const parsed = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return { ok: false };
  return { ok: true, parsed };
}

export async function updateClinicParticularPricing(input: {
  price_particular_consultation: string;
  price_particular_package: string;
}): Promise<ActionResult> {
  const session = await requireAdmin().catch(() => null);
  if (!session) return { error: "Acesso negado." };

  const consultation = parsePositiveOrEmpty(input.price_particular_consultation);
  const pkg = parsePositiveOrEmpty(input.price_particular_package);
  if (!consultation.ok || !pkg.ok) {
    return { error: "Informe valores válidos (maiores ou iguais a zero)." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("clinic_settings")
    .update({
      price_particular_consultation: consultation.parsed,
      price_particular_package: pkg.parsed,
    })
    .eq("id", 1);

  if (error) return { error: "Não foi possível salvar os valores particulares." };

  await logAudit({ actorId: session.user.id, action: "clinic_settings.particular_pricing_updated", entity: "clinic_settings", entityId: "1" });
  revalidatePublicSite();
  return { error: null };
}

export async function updateAllClinicSettings(input: {
  name: string;
  legal_name: string;
  email: string;
  website_url: string;
  address_zip: string;
  address_street: string;
  address_number: string;
  address_complement: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  address_country: string;
  whatsapp_number: string;
  phone_primary: string;
  phone_secondary: string;
  emergency_phone: string;
  business_hours: BusinessHourEntry[];
  holiday_open: boolean;
  holiday_open_time: string;
  holiday_close_time: string;
  instagram_url: string;
  facebook_url: string;
  linkedin_url: string;
  youtube_url: string;
  maps_url: string;
  latitude: string;
  longitude: string;
  price_particular_consultation: string;
  price_particular_package: string;
}): Promise<ActionResult> {
  const session = await requireAdmin().catch(() => null);
  if (!session) return { error: "Acesso negado." };

  if (!input.name.trim()) return { error: "Informe o nome da clínica." };
  const email = nullIfEmpty(input.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Informe um e-mail válido." };
  const websiteUrl = nullIfEmpty(input.website_url);
  if (websiteUrl && !isValidUrl(websiteUrl)) return { error: "Informe um site válido (com http:// ou https://)." };

  const hoursError = validateBusinessHours(input.business_hours);
  if (hoursError) return { error: hoursError };

  let holidayOpenTime: string | null = null;
  let holidayCloseTime: string | null = null;
  if (input.holiday_open) {
    if (!TIME_PATTERN.test(input.holiday_open_time) || !TIME_PATTERN.test(input.holiday_close_time)) {
      return { error: "Informe horários válidos (HH:MM) para o funcionamento em feriados." };
    }
    if (input.holiday_open_time >= input.holiday_close_time) {
      return { error: "O horário de abertura em feriados deve ser antes do fechamento." };
    }
    holidayOpenTime = input.holiday_open_time;
    holidayCloseTime = input.holiday_close_time;
  }

  const socialUrls = {
    instagram_url: nullIfEmpty(input.instagram_url),
    facebook_url: nullIfEmpty(input.facebook_url),
    linkedin_url: nullIfEmpty(input.linkedin_url),
    youtube_url: nullIfEmpty(input.youtube_url),
  };
  for (const value of Object.values(socialUrls)) {
    if (value && !isValidUrl(value)) return { error: "Informe links de redes sociais válidos (com http:// ou https://)." };
  }

  const mapsUrl = nullIfEmpty(input.maps_url);
  if (mapsUrl && !isValidUrl(mapsUrl)) return { error: "Informe um link do Google Maps válido." };
  const latRaw = input.latitude?.trim();
  const lngRaw = input.longitude?.trim();
  if ((latRaw && !lngRaw) || (!latRaw && lngRaw)) {
    return { error: "Informe latitude e longitude juntas, ou deixe ambas em branco." };
  }
  let latitude: number | null = null;
  let longitude: number | null = null;
  if (latRaw && lngRaw) {
    latitude = Number(latRaw.replace(",", "."));
    longitude = Number(lngRaw.replace(",", "."));
    if (Number.isNaN(latitude) || latitude < -90 || latitude > 90) return { error: "Latitude inválida (-90 a 90)." };
    if (Number.isNaN(longitude) || longitude < -180 || longitude > 180) return { error: "Longitude inválida (-180 a 180)." };
  }

  const consultation = parsePositiveOrEmpty(input.price_particular_consultation);
  const pkg = parsePositiveOrEmpty(input.price_particular_package);
  if (!consultation.ok || !pkg.ok) {
    return { error: "Informe valores particulares válidos (maiores ou iguais a zero)." };
  }

  const addressParts = {
    address_zip: nullIfEmpty(input.address_zip),
    address_street: nullIfEmpty(input.address_street),
    address_number: nullIfEmpty(input.address_number),
    address_complement: nullIfEmpty(input.address_complement),
    address_neighborhood: nullIfEmpty(input.address_neighborhood),
    address_city: nullIfEmpty(input.address_city),
    address_state: nullIfEmpty(input.address_state),
    address_country: nullIfEmpty(input.address_country) ?? "Brasil",
  };
  const address = buildFullAddress(addressParts);

  const supabase = await createClient();
  const { error } = await supabase
    .from("clinic_settings")
    .update({
      name: input.name.trim(),
      legal_name: nullIfEmpty(input.legal_name),
      email,
      website_url: websiteUrl,
      ...addressParts,
      address,
      whatsapp_number: nullIfEmpty(input.whatsapp_number),
      phone_primary: nullIfEmpty(input.phone_primary),
      phone_secondary: nullIfEmpty(input.phone_secondary),
      emergency_phone: nullIfEmpty(input.emergency_phone),
      business_hours: input.business_hours,
      holiday_open: input.holiday_open,
      holiday_open_time: holidayOpenTime,
      holiday_close_time: holidayCloseTime,
      ...socialUrls,
      maps_url: mapsUrl,
      latitude,
      longitude,
      price_particular_consultation: consultation.parsed,
      price_particular_package: pkg.parsed,
    })
    .eq("id", 1);

  if (error) return { error: "Não foi possível salvar as configurações." };

  await logAudit({ actorId: session.user.id, action: "clinic_settings.bulk_updated", entity: "clinic_settings", entityId: "1" });
  revalidatePublicSite();
  return { error: null };
}

export async function uploadClinicLogo(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin().catch(() => null);
  if (!session) return { error: "Acesso negado." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Nenhum arquivo selecionado." };
  }
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return { error: "Formato inválido. Envie PNG, JPG, WEBP ou SVG." };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { error: "Arquivo muito grande. Limite de 2MB." };
  }

  const admin = createAdminClient();
  const extension = file.name.split(".").pop() || "png";
  const path = `logo.${extension}`;

  const { error: uploadError } = await admin.storage
    .from("clinic-assets")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) return { error: "Falha ao enviar o logo. Tente novamente." };

  const { error: updateError } = await admin
    .from("clinic_settings")
    .update({ logo_path: path })
    .eq("id", 1);

  if (updateError) return { error: "Logo enviado, mas houve falha ao salvar." };

  await logAudit({
    actorId: session.user.id,
    action: "clinic_settings.logo_updated",
    entity: "clinic_settings",
    entityId: "1",
  });
  revalidatePublicSite();

  return { error: null };
}
