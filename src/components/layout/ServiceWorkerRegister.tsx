"use client";

import { useEffect } from "react";

/** Registra public/sw.js (estáticos + tela offline só — ver comentário lá em
 * cima sobre a regra de privacidade). Sem UI; só o efeito de registro. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
