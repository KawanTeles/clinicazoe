"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { m } from "framer-motion";
import { cn } from "@/lib/utils/cn";

// Duração da transição de cada passo — suave, não um "salto" abrupto.
const TRANSITION_MS = 600;
// Quantas cópias da lista original ficam concatenadas na trilha. Dá um
// "colchão" de itens de sobra em cada lado para rolar sem nunca mostrar
// espaço vazio nas pontas, mesmo em telas muito largas que exibem vários
// cards de uma vez. 4 cópias cobre até telas que mostrem 2x a lista inteira
// simultaneamente (bem acima de qualquer caso real de especialidades).
const COPIES = 4;

export interface MarqueeSlide {
  id: string;
  content: ReactNode;
}

interface MarqueeCarouselProps {
  slides: MarqueeSlide[];
  /** Tempo (ms) parado entre um avanço e outro (avança 1 card por vez, não uma "página"). */
  autoPlayMs?: number;
  /** Classes do card individual — controla a largura (ex: "w-64 sm:w-72"); quantos cabem na tela é decidido pelo navegador, não por JS. */
  cardClassName?: string;
  className?: string;
  ariaLabel?: string;
}

/**
 * Esteira contínua: mostra quantos cards couberem lado a lado (largura fixa
 * por card, responsiva via className — o navegador decide quantos cabem) e
 * avança um card por vez, em loop infinito, sem precisar de clique. Diferente
 * do Carousel genérico (que troca uma "página"/slide inteiro de uma vez),
 * aqui o passo é sempre de 1 item, dando a sensação de esteira em vez de
 * paginação.
 */
export function MarqueeCarousel({
  slides,
  autoPlayMs = 3000,
  cardClassName = "w-72",
  className,
  ariaLabel = "Carrossel",
}: MarqueeCarouselProps) {
  const n = slides.length;
  const loop = n > 1;
  const extended = loop ? Array.from({ length: COPIES }, () => slides).flat() : slides;
  const initialPosition = loop ? n : 0;

  const trackRef = useRef<HTMLDivElement>(null);
  const firstCardRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(initialPosition);
  const animatingRef = useRef(false);
  const autoplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stepPx, setStepPx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const card = firstCardRef.current;
    if (!card) return;
    const measure = () => setStepPx(card.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    return () => observer.disconnect();
  }, [n]);

  const applyTransform = useCallback((pos: number, animate: boolean) => {
    const track = trackRef.current;
    if (!track || stepPx === 0) return;
    track.style.transition = animate ? `transform ${TRANSITION_MS}ms cubic-bezier(0.65, 0, 0.35, 1)` : "none";
    track.style.transform = `translateX(-${pos * stepPx}px)`;
  }, [stepPx]);

  const step = useCallback(
    (delta: number) => {
      if (!loop || animatingRef.current) return;
      animatingRef.current = true;
      const next = positionRef.current + delta;
      positionRef.current = next;
      applyTransform(next, true);
    },
    [loop, applyTransform],
  );

  const clearAutoplayTimer = useCallback(() => {
    if (autoplayTimerRef.current) {
      clearTimeout(autoplayTimerRef.current);
      autoplayTimerRef.current = null;
    }
  }, []);

  const scheduleAutoplay = useCallback(() => {
    clearAutoplayTimer();
    if (!loop || isPaused) return;
    autoplayTimerRef.current = setTimeout(() => step(1), autoPlayMs);
  }, [loop, isPaused, autoPlayMs, step, clearAutoplayTimer]);

  const handleTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName !== "transform") return;
      animatingRef.current = false;

      const pos = positionRef.current;
      if (pos >= (COPIES - 1) * n) {
        positionRef.current = pos - n;
        applyTransform(positionRef.current, false);
      } else if (pos < 0) {
        positionRef.current = pos + n;
        applyTransform(positionRef.current, false);
      }

      scheduleAutoplay();
    },
    [n, applyTransform, scheduleAutoplay],
  );

  useEffect(() => {
    if (stepPx === 0) return;
    applyTransform(positionRef.current, false);
    scheduleAutoplay();
    return clearAutoplayTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepPx]);

  useEffect(() => {
    scheduleAutoplay();
    return clearAutoplayTimer;
  }, [scheduleAutoplay, clearAutoplayTimer]);

  if (n === 0) return null;

  return (
    <div
      className={cn("relative", className)}
      role="region"
      aria-roledescription="carrossel"
      aria-label={ariaLabel}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <div className="relative overflow-hidden">
        <div
          ref={trackRef}
          className="flex"
          style={{ transform: `translateX(-${initialPosition * stepPx}px)`, transition: "none" }}
          onTransitionEnd={handleTransitionEnd}
        >
          {extended.map((slide, i) => (
            <div key={`${slide.id}-${i}`} ref={i === 0 ? firstCardRef : undefined} className={cn("shrink-0 pr-6", cardClassName)}>
              {slide.content}
            </div>
          ))}
        </div>
      </div>

      {loop && (
        <>
          <m.button
            type="button"
            onClick={() => step(-1)}
            aria-label="Anterior"
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            className="absolute -left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-card/90 text-text-primary shadow-sm backdrop-blur-sm transition-colors hover:border-primary/60 hover:text-[var(--link)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </m.button>
          <m.button
            type="button"
            onClick={() => step(1)}
            aria-label="Próximo"
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            className="absolute -right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-card/90 text-text-primary shadow-sm backdrop-blur-sm transition-colors hover:border-primary/60 hover:text-[var(--link)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </m.button>
        </>
      )}
    </div>
  );
}
