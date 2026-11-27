"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/modules/auth/services/auth-client";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const WARNING_BEFORE_MS = 60 * 1000;
const CHECK_INTERVAL_MS = 10 * 1000;
const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll"] as const;

/** Desloga depois de 15 min sem interação (padrão razoável pra dado de
 * saúde de criança no celular — ajustável aqui). Avisa 1 min antes; qualquer
 * toque, clique ou tecla — inclusive fechar o próprio aviso — reresseta o
 * timer, então só desloga quem de fato ficou parado o tempo todo. */
export function InactivityLogout() {
  const router = useRouter();
  const lastActivityRef = useRef<number | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  const registerActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
  }, []);

  useEffect(() => {
    lastActivityRef.current = Date.now();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, registerActivity, { passive: true }));

    const interval = setInterval(async () => {
      const idleFor = Date.now() - (lastActivityRef.current ?? Date.now());
      if (idleFor >= IDLE_TIMEOUT_MS) {
        clearInterval(interval);
        await signOut();
        router.push("/login?reason=inactivity");
        router.refresh();
        return;
      }
      setShowWarning(idleFor >= IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, registerActivity));
      clearInterval(interval);
    };
  }, [registerActivity, router]);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 text-center shadow-[0_15px_40px_rgba(0,0,0,0.45)]">
        <p className="text-sm font-bold text-text-primary">Sessão prestes a expirar</p>
        <p className="mt-1.5 text-sm text-text-secondary">
          Por inatividade, você vai sair em instantes. Toque em qualquer lugar para continuar conectado.
        </p>
        <button
          type="button"
          onClick={registerActivity}
          className="mt-4 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white"
        >
          Continuar conectado
        </button>
      </div>
    </div>
  );
}
