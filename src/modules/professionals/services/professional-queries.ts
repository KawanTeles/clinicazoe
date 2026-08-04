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

  const specialtyIds = Array.from(
    new Set((professionals ?? []).map((p) => p.specialty_id).filter((id): id is string => Boolean(id))),
  );
  const { data: specialties } =
    specialtyIds.length > 0
      ? await supabase.from("specialties").select("id, name").in("id", specialtyIds)
      : { data: [] as { id: string; name: string }[] };
  const specialtyNameById = new Map((specialties ?? []).map((s) => [s.id, s.name]));

  const professionalById = new Map((professionals ?? []).map((p) => [p.id, p]));

  return Promise.all(
    profiles.map(async (profile) => {
      const professional = professionalById.get(profile.id);
      return {
        ...profile,
        avatarUrl: await getAvatarSignedUrl(supabase, profile.avatar_path),
        specialtyName: professional?.specialty_id
          ? specialtyNameById.get(professional.specialty_id) ?? null
          : null,
        bio: professional?.bio ?? null,
        licenseNumber: professional?.license_number ?? null,
        agendaColor: professional?.agenda_color ?? "#2F8F83",
      };
    }),
  );
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

  let specialtyName: string | null = null;
  if (professional?.specialty_id) {
    const { data: specialty } = await supabase
      .from("specialties")
      .select("name")
      .eq("id", professional.specialty_id)
      .single();
    specialtyName = specialty?.name ?? null;
  }

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
    specialtyName,
    insuranceNames: (insurances ?? []).map((i) => i.name),
    avatarUrl,
  };
}
