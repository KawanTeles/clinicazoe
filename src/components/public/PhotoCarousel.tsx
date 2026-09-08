"use client";

import Image from "next/image";
import { Carousel, type CarouselSlide } from "@/components/public/Carousel";
import { cn } from "@/lib/utils/cn";

export interface PhotoCarouselSlide {
  id: string;
  /** Deixe em branco até haver a foto real — o slide renderiza o placeholder "Foto em breve". */
  imageUrl?: string;
  alt?: string;
  caption?: string;
}

interface PhotoCarouselProps {
  slides: PhotoCarouselSlide[];
  autoPlayMs?: number;
  className?: string;
  /** Classe de aspect-ratio do palco do carrossel. */
  aspectClassName?: string;
}

export function PhotoCarousel({ slides, autoPlayMs = 4500, className, aspectClassName = "aspect-[16/10]" }: PhotoCarouselProps) {
  const carouselSlides: CarouselSlide[] = slides.map((slide) => ({
    id: slide.id,
    content: (
      <div className="relative h-full w-full">
        {slide.imageUrl ? (
          <>
            <Image
              src={slide.imageUrl}
              alt={slide.alt || ""}
              fill
              sizes="(max-width: 1024px) 100vw, 900px"
              className="object-cover"
            />
            {slide.caption && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-6 py-5">
                <p className="text-sm font-bold text-white">{slide.caption}</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-card to-card-elevated/30 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-[var(--icon-informative)] border border-[rgba(110,231,183,0.3)] shadow-[0_0_15px_rgba(110,231,183,0.15)]">
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
            </div>
            <p className="text-sm font-bold text-text-secondary">Foto em breve</p>
            {slide.caption && <p className="text-xs text-text-muted">{slide.caption}</p>}
          </div>
        )}
      </div>
    ),
  }));

  return (
    <Carousel
      slides={carouselSlides}
      autoPlayMs={autoPlayMs}
      className={className}
      stageClassName={cn(
        "rounded-3xl border border-border/80 bg-card-elevated/90 shadow-[var(--shadow-card)]",
        aspectClassName,
      )}
      ariaLabel="Galeria de fotos"
    />
  );
}
