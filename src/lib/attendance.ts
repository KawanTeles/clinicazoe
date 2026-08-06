import { PARTICULAR_INSURANCE_NAME } from "./constants";

export interface AttendanceInfo {
  isConvenio: boolean;
  attendanceType: "Particular" | "Convênio";
  insuranceName: string | null;
  paymentMethodLabel: string | null;
}

const PAYMENT_METHOD_MAP: Record<string, string> = {
  cartao: "Cartão",
  pix: "PIX",
  dinheiro: "Dinheiro",
  convenio: "Convênio",
};

export function getAttendanceInfo(
  insuranceName: string | null | undefined,
  paymentMethod: string | null | undefined
): AttendanceInfo {
  const normInsurance = (insuranceName ?? "").trim();
  const normPayment = (paymentMethod ?? "").trim().toLowerCase();

  const isConvenio =
    normPayment === "convenio" ||
    (normInsurance !== "" &&
      normInsurance.toLowerCase() !== PARTICULAR_INSURANCE_NAME.toLowerCase());

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
    };
  }

  return {
    isConvenio: false,
    attendanceType: "Particular",
    insuranceName: null,
    paymentMethodLabel: PAYMENT_METHOD_MAP[normPayment] ?? (normPayment || "PIX"),
  };
}
