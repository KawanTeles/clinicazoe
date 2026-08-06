"use client";

import { ReactNode } from "react";
import { motion, Variants } from "framer-motion";
import { cn } from "@/lib/utils/cn";

export type ScrollAnimationType =
  | "fade-up"
  | "slide-left"
  | "slide-right"
  | "blur-reveal"
  | "scale-up";

interface ScrollRevealProps {
  children: ReactNode;
  animation?: ScrollAnimationType;
  delayMs?: number;
  className?: string;
  durationMs?: number;
  once?: boolean;
}

const variants: Record<ScrollAnimationType, Variants> = {
  "fade-up": {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0 },
  },
  "slide-left": {
    hidden: { opacity: 0, x: -32 },
    visible: { opacity: 1, x: 0 },
  },
  "slide-right": {
    hidden: { opacity: 0, x: 32 },
    visible: { opacity: 1, x: 0 },
  },
  "blur-reveal": {
    hidden: { opacity: 0, filter: "blur(10px)", scale: 0.96 },
    visible: { opacity: 1, filter: "blur(0px)", scale: 1 },
  },
  "scale-up": {
    hidden: { opacity: 0, scale: 0.94 },
    visible: { opacity: 1, scale: 1 },
  },
};

export function ScrollReveal({
  children,
  animation = "fade-up",
  delayMs = 0,
  className = "",
  durationMs = 600,
  once = true,
}: ScrollRevealProps) {
  const selectedVariants = variants[animation] || variants["fade-up"];

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "0px 0px -40px 0px" }}
      variants={selectedVariants}
      transition={{
        duration: durationMs / 1000,
        delay: delayMs / 1000,
        ease: [0.16, 1, 0.3, 1], // Linear/Stripe/Apple physics-based easing
      }}
      className={cn("transform-gpu will-change-transform", className)}
    >
      {children}
    </motion.div>
  );
}
