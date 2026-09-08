import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type Tone = "neutral" | "success" | "warning" | "danger" | "premium";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-[#F2F2EF] text-[#44352C] border border-[#E6E6E2] dark:bg-[#213934] dark:text-[#C2D6D1] dark:border-[#314D47]",
  success: "bg-[rgba(30,104,90,0.10)] text-[#1E685A] border border-[rgba(30,104,90,0.15)] dark:bg-[rgba(130,169,160,0.15)] dark:text-[#82A9A0] dark:border-[rgba(130,169,160,0.25)]",
  warning: "bg-[#E0B221]/10 text-[#E0B221] border border-[#E0B221]/20",
  danger: "bg-[#B8856A]/10 text-[#B8856A] border border-[#B8856A]/20",
  premium: "bg-[rgba(30,104,90,0.10)] text-[#1E685A] border border-[rgba(30,104,90,0.18)] dark:bg-[rgba(130,169,160,0.15)] dark:text-[#82A9A0] dark:border-[rgba(130,169,160,0.25)]",
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
