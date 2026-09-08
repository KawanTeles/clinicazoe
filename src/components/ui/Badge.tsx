import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type Tone = "neutral" | "success" | "warning" | "danger" | "premium";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-[var(--badge-neutral-bg)] text-[var(--badge-neutral-text)] border border-[var(--badge-neutral-border)]",
  success: "bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20",
  warning: "bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20",
  danger: "bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/20",
  premium: "bg-[var(--badge-bg)] text-[var(--badge-text)] border border-[var(--badge-text)]/20",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold tracking-wide transition-all duration-200 ease-out hover:scale-105 transform-gpu cursor-default",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
