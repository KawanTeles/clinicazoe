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
  let insurances: { insurance_id: string; value: number }[] = [];
  if (profile.role === "profissional") {
    const { data } = await supabase.from("professionals").select("*").eq("id", id).single();
    professional = data;

    const { data: links } = await supabase
      .from("professional_insurances")
      .select("insurance_id, value")
      .eq("professional_id", id);
    insurances = links ?? [];
  }

  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(id);

  return { profile, professional, insurances, email: authUser.user?.email ?? "" };
}
