"use client";

import { ButtonHTMLAttributes, forwardRef, memo } from "react";
import { m } from "framer-motion";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  /** Renders a nested circular arrow at the trailing edge instead of a plain "→" glyph. */
  withArrow?: boolean;
}

const arrowCircleSize: Record<Size, string> = {
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-7 w-7",
};

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[var(--secondary)] text-white hover:bg-[var(--secondary-hover)] active:bg-[var(--secondary-hover)] border border-[var(--secondary-hover)]/50 shadow-[var(--shadow-button)] hover:shadow-[var(--shadow-card-hover)]",
  secondary:
    "bg-[var(--primary)] text-white border border-[var(--primary)]/80 hover:bg-[var(--primary-hover)] hover:border-[var(--primary-hover)] shadow-xs",
  outline:
    "bg-transparent text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--card-elevated)] hover:border-[var(--text-muted)]",
  ghost:
    "bg-transparent text-[var(--text-secondary)] border-0 hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] active:bg-[var(--primary)]/20",
  danger:
    "bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/30 hover:bg-[var(--danger)] hover:text-white hover:border-[var(--danger)] active:bg-[var(--danger)]/80",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3.5 text-xs font-semibold rounded-lg",
  md: "h-11 px-5 text-sm font-bold rounded-xl",
  lg: "h-12 px-6 text-base font-bold rounded-xl",
};

export const Button = memo(
  forwardRef<HTMLButtonElement, ButtonProps>(
    (
      { className, variant = "primary", size = "md", isLoading = false, withArrow = false, disabled, children, onClick, type = "button", ...props },
      ref,
    ) => {
      return (
        <m.button
          ref={ref}
          type={type}
          disabled={disabled || isLoading}
          aria-busy={isLoading || undefined}
          whileHover={disabled || isLoading ? undefined : { scale: 1.02, y: -1 }}
          whileTap={disabled || isLoading ? undefined : { scale: 0.97, y: 0 }}
          transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
          onClick={onClick}
          className={cn(
            "group inline-flex items-center justify-center text-center gap-2 font-semibold transition-colors duration-200 cursor-pointer transform-gpu will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
            variantClasses[variant],
            sizeClasses[size],
            className,
          )}
          {...(props as any)}
        >
          {isLoading && (
            <svg
              className="h-4 w-4 shrink-0 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-90"
                fill="currentColor"
                d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z"
              />
            </svg>
          )}
          {children}
          {withArrow && !isLoading && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center justify-center rounded-full bg-white/15 transition-all duration-200 ease-out group-hover:translate-x-1 group-hover:-translate-y-px group-hover:bg-white/25",
                arrowCircleSize[size],
              )}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="19" x2="19" y2="5" />
                <polyline points="8 5 19 5 19 16" />
              </svg>
            </span>
          )}
        </m.button>
      );
    },
  ),
);

Button.displayName = "Button";
