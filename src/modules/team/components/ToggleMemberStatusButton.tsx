"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { setUserStatus } from "@/modules/user-management/services/user-actions";
import type { Status } from "@/lib/supabase/types";

export function ToggleMemberStatusButton({
  id,
  name,
  status,
  isSelf,
}: {
  id: string;
  name: string;
  status: Status;
  isSelf: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  if (isSelf) return null;

  const nextStatus: Status = status === "active" ? "inactive" : "active";

  async function handleToggle() {
    const confirmed = await confirm({
      title: nextStatus === "inactive" ? `Desativar "${name}"?` : `Ativar "${name}"?`,
      description:
        nextStatus === "inactive"
          ? "A pessoa perde acesso ao sistema imediatamente e some das listas ativas (inclusive do site público e da seleção de agendamento, se for profissional), mas o histórico de atendimentos e evoluções assinadas por ela é preservado."
          : "A pessoa volta a ter acesso ao sistema e a aparecer nas listas ativas.",
      confirmLabel: nextStatus === "inactive" ? "Desativar" : "Ativar",
      tone: nextStatus === "inactive" ? "danger" : "default",
    });
    if (!confirmed) return;

    setLoading(true);
    const { error } = await setUserStatus(id, nextStatus);
    setLoading(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success(nextStatus === "inactive" ? `"${name}" foi desativado.` : `"${name}" foi ativado.`);
    router.refresh();
  }

  return (
    <Button variant="secondary" size="sm" isLoading={loading} onClick={handleToggle}>
      {status === "active" ? "Desativar" : "Ativar"}
    </Button>
  );
}
