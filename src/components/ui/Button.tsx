import { ButtonHTMLAttributes, forwardRef } from "react";
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
    "bg-[#0F766E] text-white hover:bg-[#115E59] active:bg-[#0D9488] shadow-[0_10px_25px_rgba(15,118,110,0.18)] hover:-translate-y-0.5 disabled:opacity-50 disabled:shadow-none disabled:translate-y-0 border border-[#0F766E]/30",
  secondary:
    "bg-white text-[#0F766E] border border-[#CBD5E1] hover:bg-[#F8FAFC] hover:border-[#0F766E] dark:bg-[#1E293B] dark:text-[#2DD4BF] dark:border-border dark:hover:bg-[#334155] dark:hover:border-[#2DD4BF] shadow-xs hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0",
  outline:
    "bg-transparent text-[#334155] border border-[#CBD5E1] hover:bg-[#F8FAFC] hover:border-[#94A3B8] dark:text-text-secondary dark:border-border dark:hover:bg-[#1E293B] disabled:opacity-50",
  ghost:
    "bg-transparent text-[#475569] border-0 hover:bg-[rgba(15,118,110,0.06)] hover:text-[#0F766E] dark:text-text-muted dark:hover:bg-[rgba(45,212,191,0.1)] dark:hover:text-[#2DD4BF] active:bg-[rgba(15,118,110,0.12)] disabled:opacity-50",
  danger:
    "bg-[#DC2626]/10 text-[#DC2626] dark:text-[#F87171] border border-[#DC2626]/30 hover:bg-[#DC2626] hover:text-white hover:border-[#DC2626] active:bg-[#B91C1C] disabled:opacity-50",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3.5 text-xs font-semibold rounded-lg",
  md: "h-11 px-5 text-sm font-bold rounded-xl",
  lg: "h-12 px-6 text-base font-bold rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", isLoading = false, withArrow = false, disabled, children, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        className={cn(
          "group inline-flex items-center justify-center text-center gap-2 font-semibold transition-all duration-300 ease-[var(--ease-premium)] cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:cursor-not-allowed disabled:active:scale-100",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
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
              "inline-flex shrink-0 items-center justify-center rounded-full bg-white/15 transition-all duration-300 ease-[var(--ease-premium)] group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:bg-white/25",
              arrowCircleSize[size],
            )}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="19" x2="19" y2="5" />
              <polyline points="8 5 19 5 19 16" />
            </svg>
          </span>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";

