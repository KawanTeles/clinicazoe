"use client";

import { ReactNode } from "react";
import { motion, Variants } from "framer-motion";
import { cn } from "@/lib/utils/cn";

interface PageEntranceProps {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: [0.32, 0.72, 0, 1],
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

export const pageItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 18,
    scale: 0.99,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

export function PageEntrance({ children, className = "", delayMs = 0 }: PageEntranceProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={cn("w-full transform-gpu", className)}
    >
      {children}
    </motion.div>
  );
}

export function PageEntranceItem({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={pageItemVariants} className={cn("transform-gpu", className)}>
      {children}
    </motion.div>
  );
}
