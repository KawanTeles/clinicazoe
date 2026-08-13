import type { Modality, ParticularProduct } from "@/lib/supabase/types";

export const PARTICULAR_INSURANCE_NAME = "Particular";
export const UNIMED_INSURANCE_NAME = "Unimed";
export const POSTAL_SAUDE_INSURANCE_NAME = "Postal Saúde";
export const MODALITY_INSURANCE_NAMES: string[] = [UNIMED_INSURANCE_NAME, POSTAL_SAUDE_INSURANCE_NAME];

export function insuranceRequiresModality(insuranceName: string | null | undefined): boolean {
  return !!insuranceName && MODALITY_INSURANCE_NAMES.includes(insuranceName);
}

export const MODALITY_LABELS: Record<Modality, string> = {
  aba: "ABA",
  comum: "Comum",
};

export const PARTICULAR_PRODUCT_LABELS: Record<ParticularProduct, string> = {
  consulta: "Atendimento Particular",
  pacote: "Pacote Particular (1 mês)",
};
