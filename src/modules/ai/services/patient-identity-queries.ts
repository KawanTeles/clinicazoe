import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { PatientIdentityForMasking } from "./pii-masking";

/**
 * Reúne tudo que já está cadastrado sobre o paciente e serve como identidade
 * a mascarar antes de qualquer chamada de IA (ver pii-masking.ts). Best
 * effort: cada busca é independente e silenciosa — se RLS negar, se o
 * paciente não tiver `patient_details`, ou se não houver termo de imagem
 * vigente, o campo correspondente simplesmente fica de fora da máscara, sem
 * quebrar o fluxo de IA.
 */
export async function getPatientIdentityForMasking(
  supabase: SupabaseClient<Database>,
  patientId: string,
): Promise<Omit<PatientIdentityForMasking, "patientName" | "professionalName">> {
  const [{ data: details }, { data: consent }] = await Promise.all([
    supabase
      .from("patient_details")
      .select("cpf, whatsapp, email, address, insurance_card_number")
      .eq("id", patientId)
      .maybeSingle(),
    supabase
      .from("image_consents")
      .select("guardian_name")
      .eq("patient_id", patientId)
      .is("revoked_at", null)
      .order("signed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    guardianName: consent?.guardian_name ?? null,
    cpf: details?.cpf ?? null,
    phone: details?.whatsapp ?? null,
    email: details?.email ?? null,
    address: details?.address ?? null,
    insuranceCardNumber: details?.insurance_card_number ?? null,
  };
}
