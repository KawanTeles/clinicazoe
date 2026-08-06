"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, animate } from "framer-motion";

interface AnimatedCounterProps {
  value: string | number;
  duration?: number;
  className?: string;
}

/**
 * Parses numeric part and prefix/suffix from strings like "99.8%", "+20k", "100%", "45"
 * and animates counting when scrolled into view.
 */
export function AnimatedCounter({ value, duration = 1.5, className = "" }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "0px 0px -50px 0px" });
  const [displayValue, setDisplayValue] = useState<string>("0");

  useEffect(() => {
    if (!isInView) return;

    const strValue = String(value);
    // Extract numerical core, e.g. "99.8%" -> core: 99.8, prefix: "", suffix: "%"
    // "+20k" -> core: 20, prefix: "+", suffix: "k"
    const match = strValue.match(/^([^0-9.]*)([0-9.]+)(.*)$/);

    if (!match) {
      setDisplayValue(strValue);
      return;
    }

    const [, prefix, numStr, suffix] = match;
    const targetNum = parseFloat(numStr);
    const isDecimal = numStr.includes(".");
    const decimalPlaces = isDecimal ? numStr.split(".")[1].length : 0;

    const controls = animate(0, targetNum, {
      duration,
      ease: [0.16, 1, 0.3, 1], // Framer/Linear smooth easing
      onUpdate: (latest) => {
        const formattedNum = isDecimal ? latest.toFixed(decimalPlaces) : Math.floor(latest).toLocaleString("pt-BR");
        setDisplayValue(`${prefix}${formattedNum}${suffix}`);
      },
    });

    return () => controls.stop();
  }, [isInView, value, duration]);

  return (
    <span ref={ref} className={className}>
      {displayValue}
    </span>
  );
}
