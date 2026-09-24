import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvatarSignedUrl } from "@/lib/supabase/storage";
import { requireAdmin } from "@/lib/auth";
import type { Modality } from "@/lib/supabase/types";

export async function getTeamMembers() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .in("role", ["admin", "recepcionista", "profissional"])
    .order("created_at", { ascending: false });

  const members = data ?? [];

  const withAvatars = await Promise.all(
    members.map(async (member) => ({
      ...member,
      avatarUrl: await getAvatarSignedUrl(supabase, member.avatar_path),
    })),
  );

  return withAvatars;
}

export async function getTeamMember(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", id).single();

  if (!profile) return null;

  let professional = null;
  let insurances: { insurance_id: string; modality: Modality; value: number; duration_minutes: number | null }[] = [];
  let specialtyIds: string[] = [];
  if (profile.role === "profissional") {
    const { data } = await supabase.from("professionals").select("*").eq("id", id).single();
    professional = data;

    const { data: links } = await supabase
      .from("professional_insurances")
      .select("insurance_id, modality, value, duration_minutes")
      .eq("professional_id", id);
    insurances = links ?? [];

    const { data: specialtyLinks } = await supabase
      .from("professional_specialties")
      .select("specialty_id")
      .eq("professional_id", id);
    specialtyIds = (specialtyLinks ?? []).map((link) => link.specialty_id);
  }

  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(id);

  return { profile, professional, insurances, specialtyIds, email: authUser.user?.email ?? "" };
}
