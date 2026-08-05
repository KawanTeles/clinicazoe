"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils/cn";

interface PublicHeaderProps {
  clinicName: string;
}

const NAV_LINKS = [
  { href: "/", label: "Início" },
  { href: "/clinica", label: "A Clínica" },
  { href: "/especialidades", label: "Especialidades" },
  { href: "/profissionais", label: "Profissionais" },
  { href: "/convenios", label: "Convênios" },
  { href: "/contato", label: "Contato" },
];

export function PublicHeader({ clinicName }: PublicHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Floating island nav — detached from the viewport edge */}
      <header className="sticky top-4 z-50 px-4 sm:top-6 sm:px-6">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between rounded-full border border-border bg-[var(--bg-header)] px-3 pl-5 shadow-[0_15px_45px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-shadow duration-300 ease-[var(--ease-premium)] sm:px-4 sm:pl-6">
          {/* Brand Logo */}
          <Link href="/" className="group flex shrink-0 items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-forest text-xs font-extrabold text-white shadow-[0_0_16px_rgba(15,164,122,0.35)] transition-transform duration-300 ease-[var(--ease-premium)] group-hover:scale-105">
              CZ
            </div>
            <span className="hidden text-base font-bold tracking-tight text-text-primary transition-colors group-hover:text-[var(--link-hover)] font-heading sm:inline">
              {clinicName}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-6 text-sm font-semibold text-text-secondary lg:flex">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="transition-colors hover:text-[var(--link-hover)]">
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Action Buttons & Theme Toggle */}
          <div className="flex items-center gap-2">
            <ThemeToggle className="hidden sm:flex" />

            <div className="hidden items-center gap-2 lg:flex">
              <Link href="/equipe">
                <Button variant="ghost" size="sm" className="font-semibold">
                  Área da Equipe
                </Button>
              </Link>
              <Link href="/cliente/login">
                <Button size="sm" withArrow className="font-bold">
                  Área do Cliente
                </Button>
              </Link>
            </div>

            <ThemeToggle className="sm:hidden" />

            {/* Mobile Hamburger */}
            <button
              aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-primary transition-colors hover:bg-card-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
            >
              <span className="relative block h-4 w-4">
                <span
                  className={cn(
                    "absolute left-0 top-0 h-[1.5px] w-4 origin-center rounded-full bg-current transition-all duration-300 ease-[var(--ease-premium)]",
                    mobileMenuOpen ? "top-[7px] rotate-45" : "top-0 rotate-0",
                  )}
                />
                <span
                  className={cn(
                    "absolute left-0 top-[7px] h-[1.5px] w-4 rounded-full bg-current transition-all duration-200 ease-[var(--ease-premium)]",
                    mobileMenuOpen ? "opacity-0" : "opacity-100",
                  )}
                />
                <span
                  className={cn(
                    "absolute bottom-0 left-0 h-[1.5px] w-4 origin-center rounded-full bg-current transition-all duration-300 ease-[var(--ease-premium)]",
                    mobileMenuOpen ? "bottom-[7px] -rotate-45" : "bottom-0 rotate-0",
                  )}
                />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Overlay Menu */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/98 transition-opacity duration-300 ease-[var(--ease-premium)] lg:hidden",
          mobileMenuOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <nav className="flex h-full flex-col items-center justify-center gap-2 px-6">
          {NAV_LINKS.map((link, index) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              style={{ transitionDelay: mobileMenuOpen ? `${index * 60 + 100}ms` : "0ms" }}
              className={cn(
                "text-2xl font-bold text-text-primary font-heading transition-all duration-500 ease-[var(--ease-premium)] hover:text-[var(--link-hover)]",
                mobileMenuOpen ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
              )}
            >
              {link.label}
            </Link>
          ))}

          <div
            className="mt-8 flex w-full max-w-xs flex-col gap-3 transition-all duration-500 ease-[var(--ease-premium)]"
            style={{
              transitionDelay: mobileMenuOpen ? `${NAV_LINKS.length * 60 + 150}ms` : "0ms",
              opacity: mobileMenuOpen ? 1 : 0,
              transform: mobileMenuOpen ? "translateY(0)" : "translateY(2rem)",
            }}
          >
            <div className="flex justify-center mb-2">
              <ThemeToggle showLabel />
            </div>
            <Link href="/cliente/login" onClick={() => setMobileMenuOpen(false)}>
              <Button size="lg" withArrow className="w-full font-bold">
                Área do Cliente
              </Button>
            </Link>
            <Link href="/equipe" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="secondary" size="lg" className="w-full font-bold">
                Área da Equipe
              </Button>
            </Link>
          </div>
        </nav>
      </div>
    </>
  );
}
