"use client";

import { useEffect } from "react";

export function PrintOnMount() {
  useEffect(() => {
    const timeout = setTimeout(() => window.print(), 300);
    return () => clearTimeout(timeout);
  }, []);
  return null;
}
