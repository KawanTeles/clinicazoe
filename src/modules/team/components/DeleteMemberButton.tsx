"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { deleteTeamMember } from "@/modules/team/services/team-actions";

export function DeleteMemberButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      `Excluir "${name}" permanentemente? Essa ação não pode ser desfeita.`,
    );
    if (!confirmed) return;

    setLoading(true);
    const { error } = await deleteTeamMember(id);
    setLoading(false);

    if (error) {
      window.alert(error);
      return;
    }

    router.refresh();
  }

  return (
    <Button variant="danger" size="sm" disabled={loading} onClick={handleDelete}>
      {loading ? "Excluindo..." : "Excluir"}
    </Button>
  );
}
