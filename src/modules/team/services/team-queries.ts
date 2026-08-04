import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvatarSignedUrl } from "@/lib/supabase/storage";

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
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", id).single();

  if (!profile) return null;

  let professional = null;
  let insuranceIds: string[] = [];
  if (profile.role === "profissional") {
    const { data } = await supabase.from("professionals").select("*").eq("id", id).single();
    professional = data;

    const { data: links } = await supabase
      .from("professional_insurances")
      .select("insurance_id")
      .eq("professional_id", id);
    insuranceIds = (links ?? []).map((link) => link.insurance_id);
  }

  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(id);

  return { profile, professional, insuranceIds, email: authUser.user?.email ?? "" };
}
