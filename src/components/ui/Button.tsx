import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[#145A43] text-white hover:bg-[#1F6B52] active:bg-[#0B3D2E] shadow-[0_12px_35px_rgba(20,90,67,0.35)] disabled:opacity-50 disabled:shadow-none border border-[#2E8B57]/40",
  secondary:
    "bg-[#17382D] text-[#F5F7F6] border border-[#255044] hover:bg-[#102A22] hover:border-[#2E8B57]/50 active:bg-[#081C15] disabled:opacity-50",
  ghost:
    "bg-transparent text-[#C8D4CF] hover:bg-[#2E8B57]/15 hover:text-[#5ED39D] active:bg-[#2E8B57]/25 disabled:opacity-50",
  danger:
    "bg-[#DC4F4F]/15 text-[#FF8A8A] border border-[#DC4F4F]/30 hover:bg-[#DC4F4F]/25 active:bg-[#DC4F4F]/40 disabled:opacity-50",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3.5 text-xs font-medium rounded-lg",
  md: "h-11 px-5 text-sm font-semibold rounded-xl",
  lg: "h-12 px-6 text-base font-semibold rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 ease-in-out cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E8B57] focus-visible:ring-offset-2 focus-visible:ring-offset-[#081C15] disabled:cursor-not-allowed disabled:active:scale-100",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

