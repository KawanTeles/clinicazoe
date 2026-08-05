import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
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
    "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] active:bg-[var(--primary-dark)] shadow-[var(--shadow-button)] hover:shadow-[0_12px_30px_rgba(15,164,122,0.35)] hover:-translate-y-0.5 disabled:opacity-50 disabled:shadow-none disabled:translate-y-0 border border-[var(--primary)]/40",
  secondary:
    "bg-transparent text-[var(--link)] border-1.5 border-[var(--primary)] hover:bg-[var(--primary)] hover:text-white hover:border-[var(--primary)] hover:-translate-y-0.5 active:bg-[var(--primary-dark)] disabled:opacity-50 disabled:translate-y-0",
  ghost:
    "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--primary)]/12 hover:text-[var(--primary)] active:bg-[var(--primary)]/20 disabled:opacity-50",
  danger:
    "bg-[#EF4444]/15 text-[#EF4444] dark:text-[#F87171] border border-[#EF4444]/30 hover:bg-[#EF4444] hover:text-white hover:border-[#EF4444] active:bg-[#DC2626] disabled:opacity-50",
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
          "group inline-flex items-center justify-center gap-2 font-semibold transition-all duration-300 ease-[var(--ease-premium)] cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:cursor-not-allowed disabled:active:scale-100",
          withArrow && "pr-[0.3rem]",
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

