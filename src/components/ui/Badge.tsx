import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type Tone = "neutral" | "success" | "warning" | "danger" | "premium";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0] dark:bg-[#1E293B] dark:text-[#94A3B8] dark:border-[#334155]",
  success: "bg-[rgba(15,118,110,0.10)] text-[#0F766E] border border-[rgba(15,118,110,0.15)] dark:bg-[rgba(45,212,191,0.15)] dark:text-[#2DD4BF] dark:border-[rgba(45,212,191,0.25)]",
  warning: "bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20",
  danger: "bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/20",
  premium: "bg-[rgba(15,118,110,0.10)] text-[#0F766E] border border-[rgba(15,118,110,0.18)] dark:bg-[rgba(45,212,191,0.15)] dark:text-[#2DD4BF] dark:border-[rgba(45,212,191,0.25)]",
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

