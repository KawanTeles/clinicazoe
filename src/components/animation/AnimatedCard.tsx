"use client";

import { ReactNode } from "react";
import { motion, Variants } from "framer-motion";
import { cn } from "@/lib/utils/cn";

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  hoverScale?: number;
  hoverY?: number;
  onClick?: () => void;
}

const cardVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.98,
  },
  visible: (customDelay: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      delay: customDelay / 1000,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
};

export function AnimatedCard({
  children,
  className = "",
  delayMs = 0,
  hoverScale = 1.02,
  hoverY = -4,
  onClick,
}: AnimatedCardProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      custom={delayMs}
      variants={cardVariants}
      whileHover={{
        y: hoverY,
        scale: hoverScale,
        transition: { duration: 0.25, ease: [0.32, 0.72, 0, 1] },
      }}
      whileTap={{
        scale: 0.98,
        transition: { duration: 0.15 },
      }}
      onClick={onClick}
      className={cn(
        "transform-gpu will-change-transform rounded-2xl border border-border bg-card shadow-card hover:shadow-card-hover hover:border-primary/50 transition-colors",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}
