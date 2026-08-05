"use client";

import { useEffect, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "6xl" | "full";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: ModalSize;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  "2xl": "max-w-5xl",
  "4xl": "max-w-6xl",
  "6xl": "max-w-7xl",
  full: "max-w-[95vw] h-[92vh]",
};

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  size = "lg",
  children,
  footer,
  className,
}: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop with blur & smooth fade */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        className={cn(
          "relative flex w-full flex-col rounded-2xl border border-border bg-card shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh]",
          sizeClasses[size],
          className
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-card-elevated/40 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-text-primary tracking-tight font-heading">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-text-secondary font-medium">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-text-muted hover:bg-card-elevated hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Fechar modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 text-text-secondary">
          {children}
        </div>

        {/* Sticky Footer */}
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border bg-card-elevated/50 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
