"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/modules/team/services/audit";

const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export async function updateClinicSettings(input: {
  name: string;
  whatsapp_number: string;
  address: string;
}): Promise<{ error: string | null }> {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "admin") {
    return { error: "Acesso negado." };
  }

  if (!input.name.trim()) return { error: "Informe o nome da clínica." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("clinic_settings")
    .update({
      name: input.name.trim(),
      whatsapp_number: input.whatsapp_number.trim() || null,
      address: input.address.trim() || null,
    })
    .eq("id", 1);

  if (error) return { error: "Não foi possível salvar as configurações." };

  await logAudit({
    actorId: session.user.id,
    action: "clinic_settings.updated",
    entity: "clinic_settings",
    entityId: "1",
  });

  return { error: null };
}

export async function uploadClinicLogo(formData: FormData): Promise<{ error: string | null }> {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "admin") {
    return { error: "Acesso negado." };
  }

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

  return { error: null };
}
