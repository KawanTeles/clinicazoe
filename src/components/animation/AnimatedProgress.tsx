"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

interface AnimatedProgressProps {
  value: number; // 0 to 100
  height?: string;
  className?: string;
  barClassName?: string;
  delayMs?: number;
}

export function AnimatedProgress({
  value,
  height = "h-2",
  className = "",
  barClassName = "",
  delayMs = 0,
}: AnimatedProgressProps) {
  const percentage = Math.min(Math.max(value, 0), 100);

  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-card-elevated border border-border/40", height, className)}>
      <motion.div
        initial={{ width: 0 }}
        whileInView={{ width: `${percentage}%` }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{
          duration: 1.2,
          delay: delayMs / 1000,
          ease: [0.16, 1, 0.3, 1],
        }}
        className={cn("h-full rounded-full bg-gradient-to-r from-primary to-[var(--link)] shadow-sm transform-gpu", barClassName)}
      />
    </div>
  );
}
