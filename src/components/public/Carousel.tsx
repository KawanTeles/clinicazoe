"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { m } from "framer-motion";
import { cn } from "@/lib/utils/cn";

export interface CarouselSlide {
  id: string;
  content: ReactNode;
}

interface CarouselProps {
  slides: CarouselSlide[];
  /** Intervalo do autoplay em ms. */
  autoPlayMs?: number;
  /** Classes do wrapper externo (layout: largura máxima, margem). */
  className?: string;
  /** Classes do palco interno onde o slide é renderizado (moldura visual: borda, fundo, aspect-ratio, padding para as setas). */
  stageClassName?: string;
  ariaLabel?: string;
}

/**
 * Trilha contínua (translateX) com clones do primeiro/último slide nas pontas:
 * ao cruzar a borda, a transição anima normalmente até o clone (idêntico ao
 * slide real) e a posição é então resetada sem transição — como o clone é
 * visualmente igual ao slide real, o reset é imperceptível, dando a sensação
 * de loop infinito sem corte.
 *
 * A posição é controlada via ref (não via useState) e aplicada diretamente
 * no DOM: manter o avanço fora do ciclo de render evita que um re-render do
 * React (disparado por outro estado, como o dot ativo) reaplique um estilo
 * "congelado" por cima da transição em andamento e quebre a animação.
 */
export function Carousel({ slides, autoPlayMs = 4500, className, stageClassName, ariaLabel = "Carrossel" }: CarouselProps) {
  const slideCount = slides.length;
  const loop = slideCount > 1;
  const extended = loop ? [slides[slideCount - 1], ...slides, slides[0]] : slides;
  const initialPosition = loop ? 1 : 0;

  const trackRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(initialPosition);
  const animatingRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const applyTransform = useCallback((pos: number, animate: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = animate ? "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)" : "none";
    track.style.transform = `translateX(-${pos * 100}%)`;
  }, []);

  const realIndexFor = useCallback((pos: number) => ((((pos - 1) % slideCount) + slideCount) % slideCount), [slideCount]);

  const step = useCallback(
    (delta: number) => {
      if (!loop || animatingRef.current) return;
      animatingRef.current = true;
      const next = positionRef.current + delta;
      positionRef.current = next;
      applyTransform(next, true);
      setActiveIndex(realIndexFor(next));
    },
    [loop, applyTransform, realIndexFor],
  );

  const goToReal = useCallback(
    (realIndex: number) => {
      if (!loop || animatingRef.current || realIndex === activeIndex) return;
      animatingRef.current = true;
      const next = realIndex + 1;
      positionRef.current = next;
      applyTransform(next, true);
      setActiveIndex(realIndex);
    },
    [loop, activeIndex, applyTransform],
  );

  const handleTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName !== "transform") return;
      animatingRef.current = false;
      const pos = positionRef.current;
      if (pos >= extended.length - 1) {
        positionRef.current = 1;
        applyTransform(1, false);
      } else if (pos <= 0) {
        positionRef.current = slideCount;
        applyTransform(slideCount, false);
      }
    },
    [extended.length, slideCount, applyTransform],
  );

  useEffect(() => {
    if (!loop || isPaused) return;
    const timer = setInterval(() => step(1), autoPlayMs);
    return () => clearInterval(timer);
  }, [loop, isPaused, autoPlayMs, step]);

  if (slideCount === 0) return null;

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
      <div className={cn("relative overflow-hidden", stageClassName)}>
        <div
          ref={trackRef}
          className="flex h-full"
          style={{ transform: `translateX(-${initialPosition * 100}%)`, transition: "none" }}
          onTransitionEnd={handleTransitionEnd}
        >
          {extended.map((slide, i) => (
            <div key={`${slide.id}-${i}`} className="h-full w-full shrink-0">
              {slide.content}
            </div>
          ))}
        </div>

        {loop && (
          <>
            <m.button
              type="button"
              onClick={() => step(-1)}
              aria-label="Slide anterior"
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.92 }}
              className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-card/90 text-text-primary shadow-sm backdrop-blur-sm transition-colors hover:border-primary/60 hover:text-[var(--link)]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </m.button>
            <m.button
              type="button"
              onClick={() => step(1)}
              aria-label="Próximo slide"
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.92 }}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-card/90 text-text-primary shadow-sm backdrop-blur-sm transition-colors hover:border-primary/60 hover:text-[var(--link)]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </m.button>
          </>
        )}
      </div>

      {loop && (
        <div className="mt-5 flex items-center justify-center gap-2">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => goToReal(i)}
              aria-label={`Ir para slide ${i + 1}`}
              aria-current={i === activeIndex}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i === activeIndex ? "w-8 bg-[var(--link)]" : "w-2 bg-border hover:bg-primary/40",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
