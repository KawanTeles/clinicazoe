"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { resetUserPassword } from "@/modules/user-management/services/user-actions";

export function ResetPasswordModal({
  userId,
  userName,
  isOpen,
  onClose,
}: {
  userId: string;
  userName: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setPassword("");
    setError(null);
    onClose();
  }

  async function handleSubmit() {
    setError(null);
    setSaving(true);
    const result = await resetUserPassword(userId, password);
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    toast.success(`Senha de "${userName}" redefinida com sucesso.`);
    handleClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Redefinir senha"
      subtitle={userName}
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSubmit} isLoading={saving}>
            Redefinir senha
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error && (
          <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
            {error}
          </div>
        )}
        <Input
          label="Nova senha"
          name="password"
          type="password"
          placeholder="Mínimo de 8 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-[11px] text-text-muted">
          O usuário poderá usar essa senha imediatamente para acessar o sistema.
        </p>
      </div>
    </Modal>
  );
}
