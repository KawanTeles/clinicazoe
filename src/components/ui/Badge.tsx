import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type Tone = "neutral" | "success" | "warning" | "danger" | "premium";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-[var(--badge-neutral-bg)] text-[var(--badge-neutral-text)] border border-[var(--badge-neutral-border)]",
  success: "bg-[var(--badge-bg)] text-[var(--badge-text)] border border-[var(--primary)]/30",
  warning: "bg-[var(--warning)]/15 text-[var(--warning)] border border-[var(--warning)]/30",
  danger: "bg-[var(--danger)]/15 text-[var(--danger)] border border-[var(--danger)]/30",
  premium: "bg-[var(--badge-bg)] text-[var(--primary-light)] border border-[var(--primary)]/40 shadow-[0_0_12px_rgba(15,164,122,0.25)]",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold tracking-wide transition-colors",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}

