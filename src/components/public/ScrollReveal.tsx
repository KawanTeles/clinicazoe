"use client";

import { useEffect, useRef, useState, ReactNode } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  animation?: "fade-up" | "slide-left" | "slide-right" | "blur-reveal" | "scale-up";
  delayMs?: number;
  className?: string;
}

export function ScrollReveal({
  children,
  animation = "fade-up",
  delayMs = 0,
  className = "",
}: ScrollRevealProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const animationStyles: Record<string, string> = {
    "fade-up": isVisible
      ? "opacity-100 translate-y-0"
      : "opacity-0 translate-y-8",
    "slide-left": isVisible
      ? "opacity-100 translate-x-0"
      : "opacity-0 -translate-x-10",
    "slide-right": isVisible
      ? "opacity-100 translate-x-0"
      : "opacity-0 translate-x-10",
    "blur-reveal": isVisible
      ? "opacity-100 blur-0 scale-100"
      : "opacity-0 blur-md scale-95",
    "scale-up": isVisible
      ? "opacity-100 scale-100"
      : "opacity-0 scale-90",
  };

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={`transition-all duration-700 ease-out transform-gpu ${animationStyles[animation]} ${className}`}
    >
      {children}
    </div>
  );
}
