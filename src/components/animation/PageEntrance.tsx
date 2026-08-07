import { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface PageEntranceProps {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}

/**
 * Animação de entrada do hero (fade + slide-up + stagger) em CSS puro — ver
 * `.page-entrance` / `.page-entrance-item` em globals.css. Não usa Framer
 * Motion de propósito: este é o conteúdo mais provável de ser o LCP de cada
 * página, e não deve depender de nenhum bundle JS carregar para pintar. Não
 * precisa ser Client Component — CSS anima sozinho, sem JS nenhum.
 */
export function PageEntrance({ children, className = "", delayMs = 0 }: PageEntranceProps) {
  return (
    <div
      style={delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
      className={cn("page-entrance w-full transform-gpu", className)}
    >
      {children}
    </div>
  );
}

export function PageEntranceItem({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cn("page-entrance-item transform-gpu", className)}>{children}</div>;
}
