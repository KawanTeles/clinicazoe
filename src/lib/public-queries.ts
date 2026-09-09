import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvatarSignedUrl } from "@/lib/supabase/storage";
import { DEFAULT_BUSINESS_HOURS } from "@/modules/settings/utils/form-state";

function resolveLogoUrl(admin: ReturnType<typeof createAdminClient>, logoPath: string | null | undefined) {
  if (!logoPath) return null;
  const { data } = admin.storage.from("clinic-assets").getPublicUrl(logoPath);
  return data.publicUrl;
}

function resolveFacadeImageUrl(admin: ReturnType<typeof createAdminClient>, facadeImagePath: string | null | undefined) {
  if (!facadeImagePath) return null;
  const { data } = admin.storage.from("clinic-assets").getPublicUrl(facadeImagePath);
  return data.publicUrl;
}

function resolveGalleryUrl(admin: ReturnType<typeof createAdminClient>, storagePath: string) {
  const { data } = admin.storage.from("clinic-gallery").getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function getPublicWebsiteData() {
  const admin = createAdminClient();

  const [{ data: clinic }, { data: specialties }, { data: professionals }, { data: insurances }, { data: galleryImages }] = await Promise.all([
    admin.from("clinic_settings").select("*").eq("id", 1).single(),
    admin.from("specialties").select("*").eq("status", "active").order("name"),
    admin.from("professionals").select("*").eq("status", "active"),
    admin.from("insurances").select("*").eq("status", "active").order("display_order"),
    admin.from("clinic_gallery_images").select("*").eq("status", "active").order("display_order"),
  ]);

  const profIds = (professionals ?? []).map((p) => p.id);
  const { data: profiles } = profIds.length > 0
    ? await admin.from("profiles").select("*").in("id", profIds)
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const homeOrderById = new Map((professionals ?? []).map((p) => [p.id, p.home_display_order]));

  const fullProfessionals = (
    await Promise.all(
      (professionals ?? []).map(async (prof) => {
        const profile = profileMap.get(prof.id);
        // Defesa em profundidade: professionals.status=active não garante
        // que o profile por trás ainda seja um profissional ativo (ex:
        // promovido a admin sem passar por syncProfessionalStatus, ou role
        // alterada direto no banco). Sem isso, um recepcionista/admin com
        // linha residual em professionals apareceria no site público.
        if (!profile || profile.role !== "profissional" || profile.status !== "active") {
          return null;
        }

        const avatarUrl = await getAvatarSignedUrl(admin, profile.avatar_path);
        const spec = (specialties ?? []).find((s) => s.id === prof.specialty_id);

        return {
          id: prof.id,
          fullName: profile.full_name ?? "Profissional de Saúde",
          specialtyName: spec?.name ?? "Clínica Geral",
          licenseNumber: prof.show_license_publicly && prof.license_number ? prof.license_number : null,
          bio: prof.bio || "Especialista qualificado comprometido com a excelência no atendimento e saúde do paciente.",
          avatarUrl,
        };
      })
    )
  ).filter((prof): prof is NonNullable<typeof prof> => prof !== null);

  // Curadoria manual (Configurações → Profissionais em Destaque) de quem
  // aparece na home — subconjunto de fullProfessionals, ordenado por
  // home_display_order. A home cai para os primeiros N por nome quando não
  // há curadoria ainda (ver src/app/page.tsx), então essa lista pode vir vazia.
  const featuredProfessionals = fullProfessionals
    .filter((prof) => homeOrderById.get(prof.id) != null)
    .sort((a, b) => (homeOrderById.get(a.id) as number) - (homeOrderById.get(b.id) as number));

  return {
    clinic: clinic
      ? {
          ...clinic,
          logo_url: resolveLogoUrl(admin, clinic.logo_path),
          facade_image_url: resolveFacadeImageUrl(admin, clinic.facade_image_path),
        }
      : {
          id: 1,
          name: "",
          legal_name: null,
          email: null,
          website_url: null,
          instagram_url: null,
          facebook_url: null,
          linkedin_url: null,
          youtube_url: null,
          whatsapp_number: null,
          phone_primary: null,
          phone_secondary: null,
          emergency_phone: null,
          address: null,
          address_zip: null,
          address_street: null,
          address_number: null,
          address_complement: null,
          address_neighborhood: null,
          address_city: null,
          address_state: null,
          address_country: "Brasil",
          maps_url: null,
          latitude: null,
          longitude: null,
          business_hours: DEFAULT_BUSINESS_HOURS,
          holiday_open: false,
          holiday_open_time: null,
          holiday_close_time: null,
          logo_path: null,
          logo_url: null,
          facade_image_path: null,
          facade_image_url: null,
          price_particular_consultation: null,
          price_particular_package: null,
          created_at: "",
          updated_at: "",
        },
    specialties: specialties ?? [],
    professionals: fullProfessionals,
    featuredProfessionals,
    insurances: insurances ?? [],
    galleryImages: (galleryImages ?? []).map((image) => ({
      id: image.id,
      url: resolveGalleryUrl(admin, image.storage_path),
      altText: image.alt_text,
    })),
  };
}

/**
 * Versão enxuta de getPublicWebsiteData() para uso no layout raiz (metadata
 * e JSON-LD), que roda em toda página do site. Envolvida em cache() do React
 * para dedupe entre generateMetadata() e o corpo do RootLayout na mesma
 * requisição.
 */
export const getSiteMetadataForLayout = cache(async () => {
  const admin = createAdminClient();

  const [{ data: clinic }, { data: specialties }] = await Promise.all([
    admin.from("clinic_settings").select("*").eq("id", 1).single(),
    admin.from("specialties").select("name").eq("status", "active").order("name"),
  ]);

  return {
    clinic: clinic ? { ...clinic, logo_url: resolveLogoUrl(admin, clinic.logo_path) } : null,
    specialtyNames: (specialties ?? []).map((s) => s.name),
  };
});
