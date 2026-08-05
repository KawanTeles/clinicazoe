import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function logPatientMessage(params: {
  patientId: string;
  appointmentId?: string;
  type: "booking" | "confirmation" | "cancellation" | "reminder" | "reschedule" | "rejection";
  sentBy?: string;
}) {
  const admin = createAdminClient();
  await admin.from("patient_messages").insert({
    patient_id: params.patientId,
    appointment_id: params.appointmentId,
    type: params.type,
    sent_by: params.sentBy,
  });
}
