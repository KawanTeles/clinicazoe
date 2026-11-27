"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  markAllNotificationsRead,
  markNotificationRead,
  pollNotifications,
} from "@/modules/notifications/services/notification-actions";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

const relativeFormatter = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

function relativeTime(iso: string) {
  const diffMs = new Date(iso).getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  if (Math.abs(diffMin) < 60) return relativeFormatter.format(diffMin, "minute");
  const diffHours = Math.round(diffMin / 60);
  if (Math.abs(diffHours) < 24) return relativeFormatter.format(diffHours, "hour");
  return relativeFormatter.format(Math.round(diffHours / 24), "day");
}

// Mesmas chaves de localStorage do NotificationBell (header desktop) — de
// propósito: ajustar o som aqui ou lá afeta a mesma preferência, só a UI é
// diferente (dropdown vs. página cheia).
const SOUND_PREF_KEY = "clinicazoe:notification-sound-enabled";
const SOUND_CHOICE_KEY = "clinicazoe:notification-sound-choice";
const SOUND_CUSTOM_KEY = "clinicazoe:notification-sound-custom";
const POLL_INTERVAL_MS = 20000;
const MAX_CUSTOM_SOUND_BYTES = 250 * 1024;

const SOUND_OPTIONS = [
  { id: "ding", label: "Ding", src: "/sounds/notification-ding.wav" },
  { id: "pop", label: "Pop", src: "/sounds/notification-pop.wav" },
  { id: "sino", label: "Sino", src: "/sounds/notification-sino.wav" },
] as const;

type SoundChoice = (typeof SOUND_OPTIONS)[number]["id"] | "custom";

let hasUserInteracted = false;
if (typeof window !== "undefined") {
  const markInteracted = () => {
    hasUserInteracted = true;
  };
  window.addEventListener("pointerdown", markInteracted, { once: true, capture: true });
  window.addEventListener("keydown", markInteracted, { once: true, capture: true });
}

export function NotificationsScreen({
  initialNotifications,
  initialUnreadCount,
}: {
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem(SOUND_PREF_KEY);
    return stored === null ? true : stored === "1";
  });
  const [soundChoice, setSoundChoice] = useState<SoundChoice>(() => {
    if (typeof window === "undefined") return "ding";
    const stored = window.localStorage.getItem(SOUND_CHOICE_KEY);
    if (stored === "custom" || SOUND_OPTIONS.some((o) => o.id === stored)) return stored as SoundChoice;
    return "ding";
  });
  const [customSound, setCustomSound] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(SOUND_CUSTOM_KEY);
  });
  const [soundPanelOpen, setSoundPanelOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const knownIdsRef = useRef(new Set(initialNotifications.map((n) => n.id)));
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const resolvedSoundSrc = useMemo(() => {
    if (soundChoice === "custom" && customSound) return customSound;
    return SOUND_OPTIONS.find((o) => o.id === soundChoice)?.src ?? SOUND_OPTIONS[0].src;
  }, [soundChoice, customSound]);

  useEffect(() => {
    audioRef.current = new Audio(resolvedSoundSrc);
    audioRef.current.volume = 0.5;
  }, [resolvedSoundSrc]);

  function toggleSound() {
    setSoundEnabled((prev) => {
      const next = !prev;
      window.localStorage.setItem(SOUND_PREF_KEY, next ? "1" : "0");
      return next;
    });
  }

  function selectSound(id: SoundChoice) {
    setSoundChoice(id);
    window.localStorage.setItem(SOUND_CHOICE_KEY, id);
  }

  function previewSound(src: string) {
    const preview = new Audio(src);
    preview.volume = 0.5;
    preview.play().catch(() => {});
  }

  function handleCustomFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadError(null);

    if (!file.type.startsWith("audio/")) {
      setUploadError("Selecione um arquivo de áudio (mp3, ogg ou wav).");
      return;
    }
    if (file.size > MAX_CUSTOM_SOUND_BYTES) {
      setUploadError("Arquivo muito grande (máximo 250KB). Prefira um efeito curto.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") return;
      try {
        window.localStorage.setItem(SOUND_CUSTOM_KEY, dataUrl);
        window.localStorage.setItem(SOUND_CHOICE_KEY, "custom");
        setCustomSound(dataUrl);
        setSoundChoice("custom");
      } catch {
        setUploadError("Não foi possível salvar o som (armazenamento cheio).");
      }
    };
    reader.onerror = () => setUploadError("Não foi possível ler o arquivo.");
    reader.readAsDataURL(file);
  }

  function removeCustomSound() {
    window.localStorage.removeItem(SOUND_CUSTOM_KEY);
    setCustomSound(null);
    setUploadError(null);
    if (soundChoice === "custom") selectSound("ding");
  }

  useEffect(() => {
    const interval = setInterval(async () => {
      const result = await pollNotifications();
      if (!result) return;

      const hasNew = result.notifications.some((n) => !knownIdsRef.current.has(n.id));
      knownIdsRef.current = new Set(result.notifications.map((n) => n.id));

      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);

      if (hasNew && soundEnabled && hasUserInteracted && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [soundEnabled]);

  async function handleMarkRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    await markNotificationRead(id);
    router.refresh();
  }

  async function handleMarkAll() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setUnreadCount(0);
    await markAllNotificationsRead();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 shadow-card">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleSound}
            title={soundEnabled ? "Desativar som de notificação" : "Ativar som de notificação"}
            aria-label={soundEnabled ? "Desativar som de notificação" : "Ativar som de notificação"}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors active:bg-card-elevated"
          >
            {soundEnabled ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => setSoundPanelOpen((prev) => !prev)}
            className="text-xs font-semibold text-text-secondary active:text-text-primary"
          >
            Som da notificação
          </button>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAll}
            className="text-xs font-semibold text-[var(--link)] active:underline"
          >
            Marcar todas como lidas
          </button>
        )}
      </div>

      {soundPanelOpen && (
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-card">
          {SOUND_OPTIONS.map((option) => (
            <div key={option.id} className="flex items-center justify-between gap-2 rounded-lg px-1 py-1.5">
              <button type="button" onClick={() => selectSound(option.id)} className="flex flex-1 items-center gap-2 text-left">
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    soundChoice === option.id ? "border-primary bg-primary" : "border-border"
                  }`}
                />
                <span className="text-sm font-semibold text-text-primary">{option.label}</span>
              </button>
              <button
                type="button"
                onClick={() => previewSound(option.src)}
                className="rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-text-secondary active:border-primary/50"
              >
                Testar
              </button>
            </div>
          ))}

          <div className="flex items-center justify-between gap-2 rounded-lg px-1 py-1.5">
            <button
              type="button"
              onClick={() => customSound && selectSound("custom")}
              disabled={!customSound}
              className="flex flex-1 items-center gap-2 text-left disabled:cursor-not-allowed"
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  soundChoice === "custom" ? "border-primary bg-primary" : "border-border"
                }`}
              />
              <span className="text-sm font-semibold text-text-primary">
                Som personalizado{!customSound && " (nenhum enviado)"}
              </span>
            </button>
            <div className="flex items-center gap-1">
              {customSound && (
                <button
                  type="button"
                  onClick={() => previewSound(customSound)}
                  className="rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-text-secondary"
                >
                  Testar
                </button>
              )}
              <label className="cursor-pointer rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                {customSound ? "Trocar" : "Enviar"}
                <input type="file" accept="audio/*" onChange={handleCustomFileChange} className="hidden" />
              </label>
              {customSound && (
                <button
                  type="button"
                  onClick={removeCustomSound}
                  className="rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-text-secondary"
                >
                  Remover
                </button>
              )}
            </div>
          </div>
          {uploadError && <p className="text-[11px] font-medium text-danger">{uploadError}</p>}
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {notifications.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm font-medium text-text-secondary">
            Nenhuma notificação ainda.
          </li>
        )}
        {notifications.map((notification) => (
          <li key={notification.id}>
            <button
              type="button"
              onClick={() => !notification.read_at && handleMarkRead(notification.id)}
              className={`flex w-full flex-col gap-1 rounded-2xl border border-border px-4 py-3.5 text-left shadow-card ${
                notification.read_at ? "bg-card" : "bg-primary/10"
              }`}
            >
              <div className="flex items-center gap-2">
                {!notification.read_at && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--link)]" />
                )}
                <p className="text-sm font-bold text-text-primary">{notification.title}</p>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">{notification.message}</p>
              <p className="text-[11px] text-text-muted">{relativeTime(notification.created_at)}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
