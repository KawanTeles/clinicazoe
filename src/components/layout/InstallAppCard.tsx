"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Card discreto pra instalar o PWA na tela de início — vive só na aba
 * "Mais" (uso eventual, não compete com Hoje/Evolução). Some sozinho se já
 * estiver instalado (display-mode: standalone). */
export function InstallAppCard() {
  const [installed, setInstalled] = useState(isStandalone);
  const [ios] = useState(isIOS);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }
    function handleInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (installed) return null;

  async function handleInstallClick() {
    if (!deferredPrompt) {
      setShowIosHelp((prev) => !prev);
      return;
    }
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3.5 shadow-card">
      <button
        type="button"
        onClick={ios ? () => setShowIosHelp((prev) => !prev) : handleInstallClick}
        className="flex w-full items-center gap-3 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-text-primary">Instalar app</span>
          <span className="block text-xs text-text-secondary">Acesso rápido na tela de início, sem barra do navegador</span>
        </span>
      </button>

      {showIosHelp && ios && (
        <div className="mt-3 rounded-xl bg-card px-3.5 py-3 text-xs leading-relaxed text-text-secondary">
          No iPhone: toque em <strong>Compartilhar</strong> (ícone com seta para cima, na barra do Safari) e depois em{" "}
          <strong>&quot;Adicionar à Tela de Início&quot;</strong>.
        </div>
      )}
      {showIosHelp && !ios && !deferredPrompt && (
        <div className="mt-3 rounded-xl bg-card px-3.5 py-3 text-xs leading-relaxed text-text-secondary">
          No menu do navegador (⋮), procure <strong>&quot;Instalar app&quot;</strong> ou{" "}
          <strong>&quot;Adicionar à tela inicial&quot;</strong>.
        </div>
      )}
    </div>
  );
}
