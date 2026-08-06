import { MODALITY_LABELS, PARTICULAR_INSURANCE_NAME, PARTICULAR_PRODUCT_LABELS } from "./constants";
import type { Modality, ParticularProduct } from "./supabase/types";

export interface AttendanceInfo {
  isConvenio: boolean;
  attendanceType: "Particular" | "Convênio";
  insuranceName: string | null;
  paymentMethodLabel: string | null;
  modalityLabel: string | null;
  particularProductLabel: string | null;
}

const PAYMENT_METHOD_MAP: Record<string, string> = {
  cartao: "Cartão",
  pix: "PIX",
  dinheiro: "Dinheiro",
  convenio: "Convênio",
};

export function getAttendanceInfo(
  insuranceName: string | null | undefined,
  paymentMethod: string | null | undefined,
  modality?: Modality | null,
  particularProduct?: ParticularProduct | null,
): AttendanceInfo {
  const normInsurance = (insuranceName ?? "").trim();
  const normPayment = (paymentMethod ?? "").trim().toLowerCase();

  const isConvenio =
    normPayment === "convenio" ||
    (normInsurance !== "" &&
      normInsurance.toLowerCase() !== PARTICULAR_INSURANCE_NAME.toLowerCase());

  const modalityLabel = modality ? (MODALITY_LABELS[modality] ?? modality) : null;
  const particularProductLabel = particularProduct
    ? (PARTICULAR_PRODUCT_LABELS[particularProduct] ?? particularProduct)
    : null;

  if (isConvenio) {
    return {
      isConvenio: true,
      attendanceType: "Convênio",
      insuranceName:
        normInsurance !== "" &&
        normInsurance.toLowerCase() !== PARTICULAR_INSURANCE_NAME.toLowerCase()
          ? normInsurance
          : "Convênio",
      paymentMethodLabel: null,
      modalityLabel,
      particularProductLabel: null,
    };
  }

  return {
    isConvenio: false,
    attendanceType: "Particular",
    insuranceName: null,
    paymentMethodLabel: PAYMENT_METHOD_MAP[normPayment] ?? (normPayment || "PIX"),
    modalityLabel: null,
    particularProductLabel,
  };
}
