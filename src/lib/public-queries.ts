import { createAdminClient } from "@/lib/supabase/admin";
import { getAvatarSignedUrl } from "@/lib/supabase/storage";

export async function getPublicWebsiteData() {
  const admin = createAdminClient();

  const [{ data: clinic }, { data: specialties }, { data: professionals }, { data: insurances }] = await Promise.all([
    admin.from("clinic_settings").select("*").eq("id", 1).single(),
    admin.from("specialties").select("*").eq("status", "active").order("name"),
    admin.from("professionals").select("*").eq("status", "active"),
    admin.from("insurances").select("*").eq("status", "active").order("name"),
  ]);

  const profIds = (professionals ?? []).map((p) => p.id);
  const { data: profiles } = profIds.length > 0
    ? await admin.from("profiles").select("*").in("id", profIds)
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const fullProfessionals = await Promise.all(
    (professionals ?? []).map(async (prof) => {
      const profile = profileMap.get(prof.id);
      const avatarUrl = profile ? await getAvatarSignedUrl(admin, profile.avatar_path) : null;
      const spec = (specialties ?? []).find((s) => s.id === prof.specialty_id);

      return {
        id: prof.id,
        fullName: profile?.full_name ?? "Profissional de Saúde",
        specialtyName: spec?.name ?? "Clínica Geral",
        licenseNumber: prof.license_number ?? "CRM/Registro Ativo",
        bio: prof.bio || "Especialista qualificado comprometido com a excelência no atendimento e saúde do paciente.",
        avatarUrl,
        consultationDuration: prof.consultation_duration_minutes,
        priceParticularPix: prof.price_particular_pix,
        priceParticularCard: prof.price_particular_card,
        priceParticularCash: prof.price_particular_cash,
      };
    })
  );

  return {
    clinic: clinic ?? { name: "Clínica Zoe", address: "Av. Paulista, 1000 - São Paulo, SP", whatsapp_number: "5511999999999" },
    specialties: specialties ?? [],
    professionals: fullProfessionals,
    insurances: insurances ?? [],
  };
}
