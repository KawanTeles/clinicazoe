import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type Tone = "neutral" | "success" | "warning" | "danger" | "premium";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-[#255044]/40 text-[#C8D4CF] border border-[#255044]",
  success: "bg-[#2E8B57]/15 text-[#5ED39D] border border-[#2E8B57]/30",
  warning: "bg-[#D6B36A]/15 text-[#E5C378] border border-[#D6B36A]/30",
  danger: "bg-[#DC4F4F]/15 text-[#FF8A8A] border border-[#DC4F4F]/30",
  premium: "bg-[#2E8B57]/25 text-[#86E5B8] border border-[#2E8B57]/40 shadow-[0_0_12px_rgba(46,139,87,0.2)]",
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

