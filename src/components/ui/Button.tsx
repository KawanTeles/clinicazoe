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
    "bg-gradient-to-b from-[#1E685A] to-[#154D42] text-[#F9F9F7] hover:from-[#154D42] hover:to-[#113F36] active:from-[#113F36] active:to-[#0C2D26] border border-[#1E685A]/40 shadow-[var(--shadow-button)] hover:shadow-[var(--shadow-card-hover)]",
  secondary:
    "bg-[#82A9A0] text-[#1E685A] border border-[#82A9A0]/80 hover:bg-[#72968E] hover:border-[#72968E] dark:bg-[#213934] dark:text-[#82A9A0] dark:border-[#314D47] dark:hover:bg-[#314D47] shadow-xs",
  outline:
    "bg-transparent text-[#44352C] border border-[#E6E6E2] hover:bg-[#F2F2EF] hover:border-[#ADA7B1] dark:text-[#C2D6D1] dark:border-[#213934] dark:hover:bg-[#213934]",
  ghost:
    "bg-transparent text-[#5E4C41] border-0 hover:bg-[rgba(130,169,160,0.15)] hover:text-[#1E685A] dark:text-[#95B3AC] dark:hover:bg-[rgba(130,169,160,0.15)] dark:hover:text-[#82A9A0] active:bg-[rgba(130,169,160,0.25)]",
  danger:
    "bg-[#B8856A]/10 text-[#B8856A] dark:text-[#D19B80] border border-[#B8856A]/30 hover:bg-[#B8856A] hover:text-[#F9F9F7] hover:border-[#B8856A] active:bg-[#A3735B]",
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
            "group inline-flex items-center justify-center text-center gap-2 font-semibold transition-colors duration-200 cursor-pointer transform-gpu will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E685A] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
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
