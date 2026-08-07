"use client";

import { ReactNode } from "react";
import { LazyMotion, MotionConfig } from "framer-motion";
import loadFramerFeatures from "./lazy-features";

interface AnimationProviderProps {
  children: ReactNode;
}

/**
 * `strict` obriga todo componente animado a usar `m.*` em vez de `motion.*`
 * — evita que um componente novo volte a empacotar o motor de animação
 * duplicado. Carregamento assíncrono (ver lazy-features.ts) é seguro aqui
 * porque o hero (PageEntrance) não usa Framer Motion — é CSS puro,
 * intencionalmente, para o LCP nunca ficar refém deste import.
 */
export function AnimationProvider({ children }: AnimationProviderProps) {
  return (
    <LazyMotion features={loadFramerFeatures} strict>
      <MotionConfig
        reducedMotion="user"
        transition={{
          duration: 0.5,
          ease: [0.32, 0.72, 0, 1], // Apple / Linear style cubic-bezier
        }}
      >
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
