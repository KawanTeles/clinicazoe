import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPublicWebsiteData } from "@/lib/public-queries";
import { createClient } from "@/lib/supabase/server";
import { getAvatarSignedUrl } from "@/lib/supabase/storage";
import { PatientShell } from "@/components/patient/PatientShell";

export default async function PatientPanelLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUser();

  if (!session) {
    redirect("/cliente/login");
  }

  if (session.profile.role !== "paciente") {
    redirect("/dashboard");
  }

  const { clinic } = await getPublicWebsiteData();
  const supabase = await createClient();
  const avatarUrl = await getAvatarSignedUrl(supabase, session.profile.avatar_path, session.profile.avatar_url);

  return (
    <PatientShell
      fullName={session.profile.full_name}
      phone={session.profile.phone}
      avatarUrl={avatarUrl}
      clinicName={clinic.name}
      logoUrl={clinic.logo_url}
    >
      {children}
    </PatientShell>
  );
}
