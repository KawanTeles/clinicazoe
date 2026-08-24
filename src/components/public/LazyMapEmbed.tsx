"use client";

import { useEffect, useRef, useState } from "react";

interface LazyMapEmbedProps {
  src: string;
  title: string;
}

/**
 * O embed do Google Maps (google.com/maps?output=embed) carrega por baixo
 * dos panos o mesmo bundle da Maps JavaScript API (~400-500 KiB, ~300ms de
 * thread principal — visto no PageSpeed Insights). O `loading="lazy"` nativo
 * do iframe já ajuda, mas sua margem de pré-carregamento é generosa o
 * suficiente para o Lighthouse ainda contabilizar o carregamento mesmo sem
 * scroll do usuário. Aqui o iframe só é montado no DOM quando a seção chega
 * de fato perto da viewport (rootMargin bem mais apertado), sem mudar nada
 * pro usuário: o mapa continua aparecendo sozinho ao rolar até a seção.
 */
export function LazyMapEmbed({ src, title }: LazyMapEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="h-full w-full">
      {shouldLoad && (
        <iframe
          title={title}
          src={src}
          width="100%"
          height="100%"
          style={{ border: 0, minHeight: "350px", filter: "invert(90%) hue-rotate(180deg) brightness(95%) contrast(90%)" }}
          allowFullScreen={false}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}
    </div>
  );
}
