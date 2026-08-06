import type { BusinessHourEntry, Database } from "@/lib/supabase/types";

export type ClinicSettingsRow = Database["public"]["Tables"]["clinic_settings"]["Row"];

export interface ClinicSettingsFormState {
  name: string;
  legal_name: string;
  email: string;
  website_url: string;
  whatsapp_number: string;
  phone_primary: string;
  phone_secondary: string;
  emergency_phone: string;
  address_zip: string;
  address_street: string;
  address_number: string;
  address_complement: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  address_country: string;
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
}

export const WEEKDAY_LABELS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export const DEFAULT_BUSINESS_HOURS: BusinessHourEntry[] = [
  { day: 0, is_open: false, open_time: "08:00", close_time: "12:00" },
  { day: 1, is_open: true, open_time: "07:00", close_time: "20:00" },
  { day: 2, is_open: true, open_time: "07:00", close_time: "20:00" },
  { day: 3, is_open: true, open_time: "07:00", close_time: "20:00" },
  { day: 4, is_open: true, open_time: "07:00", close_time: "20:00" },
  { day: 5, is_open: true, open_time: "07:00", close_time: "20:00" },
  { day: 6, is_open: true, open_time: "08:00", close_time: "14:00" },
];

export function toFormState(row: ClinicSettingsRow | null): ClinicSettingsFormState {
  return {
    name: row?.name ?? "",
    legal_name: row?.legal_name ?? "",
    email: row?.email ?? "",
    website_url: row?.website_url ?? "",
    whatsapp_number: row?.whatsapp_number ?? "",
    phone_primary: row?.phone_primary ?? "",
    phone_secondary: row?.phone_secondary ?? "",
    emergency_phone: row?.emergency_phone ?? "",
    address_zip: row?.address_zip ?? "",
    address_street: row?.address_street ?? "",
    address_number: row?.address_number ?? "",
    address_complement: row?.address_complement ?? "",
    address_neighborhood: row?.address_neighborhood ?? "",
    address_city: row?.address_city ?? "",
    address_state: row?.address_state ?? "",
    address_country: row?.address_country ?? "Brasil",
    business_hours: row?.business_hours?.length ? row.business_hours : DEFAULT_BUSINESS_HOURS,
    holiday_open: row?.holiday_open ?? false,
    holiday_open_time: row?.holiday_open_time ?? "08:00",
    holiday_close_time: row?.holiday_close_time ?? "12:00",
    instagram_url: row?.instagram_url ?? "",
    facebook_url: row?.facebook_url ?? "",
    linkedin_url: row?.linkedin_url ?? "",
    youtube_url: row?.youtube_url ?? "",
    maps_url: row?.maps_url ?? "",
    latitude: row?.latitude != null ? String(row.latitude) : "",
    longitude: row?.longitude != null ? String(row.longitude) : "",
  };
}
