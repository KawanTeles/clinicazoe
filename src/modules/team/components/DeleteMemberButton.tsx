"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { deleteTeamMember } from "@/modules/team/services/team-actions";

export function DeleteMemberButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    const confirmed = await confirm({
      title: `Excluir "${name}"?`,
      description: "Essa ação é permanente e não pode ser desfeita.",
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!confirmed) return;

    setLoading(true);
    const { error } = await deleteTeamMember(id);
    setLoading(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success(`"${name}" foi excluído com sucesso.`);
    router.refresh();
  }

  return (
    <Button variant="danger" size="sm" isLoading={loading} onClick={handleDelete}>
      Excluir
    </Button>
  );
}
