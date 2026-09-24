import { createClient } from "@/lib/supabase/server";
import { getAvatarSignedUrl } from "@/lib/supabase/storage";

export async function getActiveProfessionals() {
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "profissional")
    .eq("status", "active")
    .order("full_name");

  if (!profiles || profiles.length === 0) return [];

  const ids = profiles.map((p) => p.id);

  const { data: professionals } = await supabase
    .from("professionals")
    .select("*")
    .in("id", ids);

  const { data: specialtyLinks } = await supabase
    .from("professional_specialties")
    .select("professional_id, specialty_id")
    .in("professional_id", ids);

  const specialtyIds = Array.from(new Set((specialtyLinks ?? []).map((l) => l.specialty_id)));
  const { data: specialties } =
    specialtyIds.length > 0
      ? await supabase.from("specialties").select("id, name").in("id", specialtyIds)
      : { data: [] as { id: string; name: string }[] };
  const specialtyNameById = new Map((specialties ?? []).map((s) => [s.id, s.name]));

  const specialtyNamesByProfessional = new Map<string, string[]>();
  for (const link of specialtyLinks ?? []) {
    const name = specialtyNameById.get(link.specialty_id);
    if (!name) continue;
    const list = specialtyNamesByProfessional.get(link.professional_id) ?? [];
    list.push(name);
    specialtyNamesByProfessional.set(link.professional_id, list);
  }

  const professionalById = new Map((professionals ?? []).map((p) => [p.id, p]));

  return Promise.all(
    profiles.map(async (profile) => {
      const professional = professionalById.get(profile.id);
      const names = specialtyNamesByProfessional.get(profile.id) ?? [];
      return {
        ...profile,
        avatarUrl: await getAvatarSignedUrl(supabase, profile.avatar_path),
        specialtyName: names.length > 0 ? names.join(", ") : null,
        bio: professional?.bio ?? null,
        licenseNumber: professional?.license_number ?? null,
        agendaColor: professional?.agenda_color ?? "#2F8F83",
      };
    }),
  );
}

/** Para o gerenciador de "Profissionais em Destaque" na home (Configurações). */
export async function getProfessionalsForHomeFeature() {
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "profissional")
    .eq("status", "active")
    .order("full_name");

  if (!profiles || profiles.length === 0) return [];

  const ids = profiles.map((p) => p.id);
  const { data: professionals } = await supabase
    .from("professionals")
    .select("id, home_display_order")
    .in("id", ids)
    .eq("status", "active");

  const { data: specialtyLinks } = await supabase
    .from("professional_specialties")
    .select("professional_id, specialty_id")
    .in("professional_id", ids);

  const specialtyIds = Array.from(new Set((specialtyLinks ?? []).map((l) => l.specialty_id)));
  const { data: specialties } =
    specialtyIds.length > 0
      ? await supabase.from("specialties").select("id, name").in("id", specialtyIds)
      : { data: [] as { id: string; name: string }[] };
  const specialtyNameById = new Map((specialties ?? []).map((s) => [s.id, s.name]));

  const specialtyNamesByProfessional = new Map<string, string[]>();
  for (const link of specialtyLinks ?? []) {
    const name = specialtyNameById.get(link.specialty_id);
    if (!name) continue;
    const list = specialtyNamesByProfessional.get(link.professional_id) ?? [];
    list.push(name);
    specialtyNamesByProfessional.set(link.professional_id, list);
  }

  const professionalById = new Map((professionals ?? []).map((p) => [p.id, p]));

  return profiles
    .filter((profile) => professionalById.has(profile.id))
    .map((profile) => {
      const professional = professionalById.get(profile.id)!;
      const names = specialtyNamesByProfessional.get(profile.id) ?? [];
      return {
        id: profile.id,
        fullName: profile.full_name,
        specialtyName: names.length > 0 ? names.join(", ") : null,
        homeDisplayOrder: professional.home_display_order,
      };
    });
}

export async function getActiveProfessional(id: string) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .eq("role", "profissional")
    .eq("status", "active")
    .single();

  if (!profile) return null;

  const { data: professional } = await supabase
    .from("professionals")
    .select("*")
    .eq("id", id)
    .single();

  const { data: specialtyLinks } = await supabase
    .from("professional_specialties")
    .select("specialty_id")
    .eq("professional_id", id);
  const specialtyIds = (specialtyLinks ?? []).map((l) => l.specialty_id);
  const { data: specialtyRows } =
    specialtyIds.length > 0
      ? await supabase.from("specialties").select("name").in("id", specialtyIds)
      : { data: [] as { name: string }[] };
  const specialtyNames = (specialtyRows ?? []).map((s) => s.name);

  const { data: insuranceLinks } = await supabase
    .from("professional_insurances")
    .select("insurance_id")
    .eq("professional_id", id);

  const insuranceIds = (insuranceLinks ?? []).map((link) => link.insurance_id);
  const { data: insurances } =
    insuranceIds.length > 0
      ? await supabase.from("insurances").select("id, name").in("id", insuranceIds)
      : { data: [] as { id: string; name: string }[] };

  const avatarUrl = await getAvatarSignedUrl(supabase, profile.avatar_path);

  return {
    profile,
    professional,
    specialtyNames,
    insuranceNames: (insurances ?? []).map((i) => i.name),
    avatarUrl,
  };
}
