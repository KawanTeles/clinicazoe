"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

type ConfirmTone = "default" | "danger";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setPending({ ...options, resolve });
    });
  }, []);

  function settle(value: boolean) {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <button
            aria-label="Cancelar"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => settle(false)}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            className="relative w-full max-w-sm rounded-2xl border border-[#255044] bg-[#102A22] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] animate-fade-up"
          >
            <h2 id="confirm-dialog-title" className="text-lg font-bold text-[#F5F7F6]">
              {pending.title}
            </h2>
            {pending.description && (
              <p className="mt-2 text-sm leading-relaxed text-[#C8D4CF]">{pending.description}</p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => settle(false)}>
                {pending.cancelLabel ?? "Cancelar"}
              </Button>
              <Button
                variant={pending.tone === "danger" ? "danger" : "primary"}
                size="sm"
                onClick={() => settle(true)}
              >
                {pending.confirmLabel ?? "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm deve ser usado dentro de ConfirmDialogProvider");
  return useMemo(() => ctx, [ctx]);
}
