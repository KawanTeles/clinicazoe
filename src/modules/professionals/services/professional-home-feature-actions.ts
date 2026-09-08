"use server";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/modules/team/services/audit";
import { revalidatePublicSite } from "@/lib/revalidate-public-site";

type ActionResult = { error: string | null };

export async function setProfessionalHomeFeatured(professionalId: string, featured: boolean): Promise<ActionResult> {
  const session = await requireAdmin().catch(() => null);
  if (!session) return { error: "Acesso negado." };

  const supabase = await createClient();

  if (!featured) {
    const { error } = await supabase
      .from("professionals")
      .update({ home_display_order: null })
      .eq("id", professionalId);
    if (error) return { error: "Não foi possível remover o destaque." };
  } else {
    const { data: last } = await supabase
      .from("professionals")
      .select("home_display_order")
      .not("home_display_order", "is", null)
      .order("home_display_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (last?.home_display_order ?? -1) + 1;

    const { error } = await supabase
      .from("professionals")
      .update({ home_display_order: nextOrder })
      .eq("id", professionalId);
    if (error) return { error: "Não foi possível destacar este profissional." };
  }

  await logAudit({
    actorId: session.user.id,
    action: featured ? "professional.home_featured" : "professional.home_unfeatured",
    entity: "professionals",
    entityId: professionalId,
  });
  revalidatePublicSite();

  return { error: null };
}

export async function reorderHomeFeaturedProfessionals(orderedIds: string[]): Promise<ActionResult> {
  const session = await requireAdmin().catch(() => null);
  if (!session) return { error: "Acesso negado." };

  const supabase = await createClient();
  const results = await Promise.all(
    orderedIds.map((id, index) => supabase.from("professionals").update({ home_display_order: index }).eq("id", id)),
  );

  const failed = results.find((result) => result.error);
  if (failed?.error) return { error: "Não foi possível reordenar os destaques." };

  await logAudit({
    actorId: session.user.id,
    action: "professional.home_featured_reordered",
    entity: "professionals",
    metadata: { order: orderedIds },
  });
  revalidatePublicSite();

  return { error: null };
}
