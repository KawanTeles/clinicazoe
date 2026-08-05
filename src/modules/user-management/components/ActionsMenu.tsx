"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { deleteUser, setUserStatus } from "@/modules/user-management/services/user-actions";
import { ResetPasswordModal } from "./ResetPasswordModal";
import type { Status } from "@/lib/supabase/types";

interface ActionsMenuProps {
  userId: string;
  userName: string;
  status: Status;
  isSelf: boolean;
}

const MENU_WIDTH = 192;

export function ActionsMenu({ userId, userName, status, isSelf }: ActionsMenuProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [resetOpen, setResetOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  function handleOpen() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPosition({ top: rect.bottom + 6, left: rect.right - MENU_WIDTH });
    }
    setOpen((prev) => !prev);
  }

  // Reposiciona (ou fecha) o menu se a tabela rolar/redimensionar enquanto aberto,
  // já que o painel é renderizado fora do contêiner com overflow via portal.
  useEffect(() => {
    if (!open) return;
    function reposition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setMenuPosition({ top: rect.bottom + 6, left: rect.right - MENU_WIDTH });
    }
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  async function handleToggleStatus() {
    setOpen(false);
    const nextStatus: Status = status === "active" ? "inactive" : "active";
    const confirmed = await confirm({
      title: nextStatus === "inactive" ? `Desativar "${userName}"?` : `Ativar "${userName}"?`,
      description:
        nextStatus === "inactive"
          ? "O usuário perde acesso ao sistema imediatamente, mas os dados e o histórico são preservados."
          : "O usuário volta a ter acesso ao sistema.",
      confirmLabel: nextStatus === "inactive" ? "Desativar" : "Ativar",
      tone: nextStatus === "inactive" ? "danger" : "default",
    });
    if (!confirmed) return;

    setBusy(true);
    const result = await setUserStatus(userId, nextStatus);
    setBusy(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(nextStatus === "inactive" ? `"${userName}" foi desativado.` : `"${userName}" foi ativado.`);
    router.refresh();
  }

  async function handleDelete() {
    setOpen(false);
    const confirmed = await confirm({
      title: `Excluir "${userName}"?`,
      description: "Essa ação é permanente e não pode ser desfeita. Tem certeza que deseja remover este usuário?",
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!confirmed) return;

    setBusy(true);
    const result = await deleteUser(userId);
    setBusy(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(`"${userName}" foi excluído com sucesso.`);
    router.refresh();
  }

  return (
    <div className="inline-flex justify-end">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Ações"
        disabled={busy}
        onClick={handleOpen}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card-elevated text-text-secondary transition-all hover:border-primary/50 hover:bg-card hover:text-text-primary disabled:opacity-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <button
              aria-label="Fechar menu de ações"
              className="fixed inset-0 z-[60] cursor-default"
              onClick={() => setOpen(false)}
            />
            <div
              style={{ top: menuPosition.top, left: menuPosition.left, width: MENU_WIDTH }}
              className="fixed z-[70] overflow-hidden rounded-xl border border-border bg-card-elevated shadow-[0_15px_40px_rgba(0,0,0,0.45)]"
            >
              <Link
                href={`/users/${userId}`}
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-xs font-semibold text-text-primary transition-colors hover:bg-card"
              >
                Editar
              </Link>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setResetOpen(true);
                }}
                className="block w-full px-4 py-2.5 text-left text-xs font-semibold text-text-primary transition-colors hover:bg-card"
              >
                Redefinir senha
              </button>
              {!isSelf && (
                <button
                  type="button"
                  onClick={handleToggleStatus}
                  className="block w-full px-4 py-2.5 text-left text-xs font-semibold text-text-primary transition-colors hover:bg-card"
                >
                  {status === "active" ? "Desativar" : "Ativar"}
                </button>
              )}
              {!isSelf && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="block w-full border-t border-border/60 px-4 py-2.5 text-left text-xs font-semibold text-danger transition-colors hover:bg-danger/10"
                >
                  Excluir
                </button>
              )}
            </div>
          </>,
          document.body,
        )}

      <ResetPasswordModal
        userId={userId}
        userName={userName}
        isOpen={resetOpen}
        onClose={() => setResetOpen(false)}
      />
    </div>
  );
}
