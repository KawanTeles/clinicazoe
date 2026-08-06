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
            className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] animate-fade-up"
          >
            <div className="flex items-start gap-3">
              {pending.tone === "danger" && (
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h2 id="confirm-dialog-title" className="text-lg font-bold text-text-primary">
                  {pending.title}
                </h2>
                {pending.description && (
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">{pending.description}</p>
                )}
              </div>
            </div>
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
