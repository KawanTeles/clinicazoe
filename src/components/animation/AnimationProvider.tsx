"use client";

import { ReactNode } from "react";
import { MotionConfig } from "framer-motion";

interface AnimationProviderProps {
  children: ReactNode;
}

export function AnimationProvider({ children }: AnimationProviderProps) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{
        duration: 0.5,
        ease: [0.32, 0.72, 0, 1], // Apple / Linear style cubic-bezier
      }}
    >
      {children}
    </MotionConfig>
  );
}
