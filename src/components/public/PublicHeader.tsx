"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils/cn";
import { CTA_CLIENT_AREA, CTA_TEAM_AREA } from "@/lib/cta-labels";

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
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mobileMenuOpen]);

  // Close mobile menu with Escape key
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <>
      {/* Floating Island Header with Framer Motion slide-down entry */}
      <motion.header
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="sticky top-3 z-50 px-3 sm:top-5 sm:px-6 transform-gpu"
      >
        <div
          className={cn(
            "mx-auto flex max-w-6xl items-center justify-between rounded-full border px-4 transition-all duration-300 ease-[var(--ease-premium)] transform-gpu",
            scrolled
              ? "h-16 border-[rgba(110,231,183,0.25)] bg-[var(--bg-header)]/95 shadow-[0_16px_50px_rgba(0,0,0,0.35)] backdrop-blur-[24px]"
              : "h-20 border-[rgba(110,231,183,0.14)] bg-[var(--bg-header)]/80 shadow-[0_10px_40px_rgba(0,0,0,0.2)] backdrop-blur-[20px]",
          )}
        >
          {/* Brand Logo */}
          <Link href="/" className="group flex shrink-0 items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.06, rotate: 2 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#14B8A6] via-[#0F766E] to-[#115E59] text-xs font-black text-white shadow-[0_0_18px_rgba(15,118,110,0.35)] border border-[rgba(20,184,166,0.3)] transform-gpu"
            >
              CZ
            </motion.div>
            <span className="hidden text-base font-extrabold tracking-tight text-text-primary transition-colors group-hover:text-[var(--link)] font-heading sm:inline">
              {clinicName}
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-1 text-xs font-semibold text-text-secondary lg:flex">
            {NAV_LINKS.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative px-4 py-2 rounded-full font-bold transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isActive
                      ? "bg-primary/10 text-primary border border-[#0F766E]/20 shadow-xs dark:bg-primary/25 dark:text-text-primary"
                      : "text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5",
                  )}
                >
                  {link.label}
                  {isActive && (
                    <motion.div
                      layoutId="activePill"
                      className="absolute inset-0 rounded-full border border-primary/30 bg-primary/10 dark:bg-primary/20 pointer-events-none"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Action Buttons & Theme Toggle */}
          <div className="flex items-center gap-2.5">
            <ThemeToggle className="hidden sm:flex rounded-full h-10 w-10 border border-border hover:border-primary/50" />

            <div className="hidden items-center gap-2.5 lg:flex">
              <Link href="/equipe" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                <motion.button
                  type="button"
                  tabIndex={-1}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.18 }}
                  className="rounded-full border border-border bg-white text-text-secondary hover:bg-[#F8FAFC] hover:text-text-primary hover:border-[#0F766E]/50 dark:bg-card-elevated dark:text-text-secondary dark:hover:bg-card transition-colors duration-200 px-4 py-2 text-xs font-bold cursor-pointer"
                >
                  {CTA_TEAM_AREA}
                </motion.button>
              </Link>
              <Link href="/cliente/login" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                <motion.button
                  type="button"
                  tabIndex={-1}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.18 }}
                  className="group inline-flex items-center gap-2 rounded-full bg-[#0F766E] hover:bg-[#115E59] px-5 py-2.5 text-xs font-bold text-white shadow-[0_10px_25px_rgba(15,118,110,0.18)] border border-[#0F766E]/30 cursor-pointer"
                >
                  <span>{CTA_CLIENT_AREA}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-transform duration-200 group-hover:translate-x-1"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </motion.button>
              </Link>
            </div>

            <ThemeToggle className="sm:hidden rounded-full h-9 w-9 border border-[rgba(110,231,183,0.2)]" />

            {/* Mobile Hamburger Button */}
            <motion.button
              type="button"
              aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={mobileMenuOpen}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[rgba(110,231,183,0.2)] bg-card-elevated/80 text-text-primary transition-colors duration-200 hover:border-[var(--link)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden cursor-pointer"
            >
              <span className="relative block h-4 w-4">
                <span
                  className={cn(
                    "absolute left-0 top-0 h-[2px] w-4 origin-center rounded-full bg-current transition-all duration-300 ease-[var(--ease-premium)]",
                    mobileMenuOpen ? "top-[7px] rotate-45" : "top-0 rotate-0",
                  )}
                />
                <span
                  className={cn(
                    "absolute left-0 top-[7px] h-[2px] w-4 rounded-full bg-current transition-all duration-200 ease-[var(--ease-premium)]",
                    mobileMenuOpen ? "opacity-0" : "opacity-100",
                  )}
                />
                <span
                  className={cn(
                    "absolute bottom-0 left-0 h-[2px] w-4 origin-center rounded-full bg-current transition-all duration-300 ease-[var(--ease-premium)]",
                    mobileMenuOpen ? "bottom-[7px] -rotate-45" : "bottom-0 rotate-0",
                  )}
                />
              </span>
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Mobile Drawer Panel with AnimatePresence */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop Fade */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 bg-black/65 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Sliding Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-0 right-0 h-full w-full max-w-sm border-l border-[rgba(110,231,183,0.18)] bg-card/95 backdrop-blur-[24px] p-6 shadow-2xl flex flex-col justify-between"
            >
              {/* Top Panel Bar */}
              <div>
                <div className="flex items-center justify-between pb-6 border-b border-border/70">
                  <Link href="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#6EE7B7] via-[#2E8B57] to-[#0B3D2E] text-xs font-black text-white border border-[rgba(110,231,183,0.3)] shadow-[0_0_15px_rgba(110,231,183,0.3)]">
                      CZ
                    </div>
                    <span className="text-base font-extrabold text-text-primary font-heading">{clinicName}</span>
                  </Link>

                  {/* Close Button */}
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label="Fechar menu"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(110,231,183,0.2)] bg-card-elevated text-text-primary hover:border-[var(--link)] transition-colors duration-200 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </motion.button>
                </div>

                {/* Navigation Items Staggered */}
                <nav className="mt-8 flex flex-col gap-2">
                  {NAV_LINKS.map((link, index) => {
                    const isActive =
                      link.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(link.href);

                    return (
                      <motion.div
                        key={link.href}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ delay: 0.06 * index + 0.1, duration: 0.3 }}
                      >
                        <Link
                          href={link.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center justify-between rounded-xl px-4 py-3 text-base font-semibold transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                            isActive
                              ? "bg-primary/25 text-text-primary font-bold border-l-4 border-[var(--link)] shadow-sm"
                              : "text-text-secondary hover:bg-card-elevated/70 hover:text-text-primary",
                          )}
                        >
                          <span>{link.label}</span>
                          {isActive && (
                            <span className="h-2 w-2 rounded-full bg-[var(--link)] shadow-[0_0_8px_var(--link)]" />
                          )}
                        </Link>
                      </motion.div>
                    );
                  })}
                </nav>
              </div>

              {/* Bottom Panel Actions Staggered */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ delay: NAV_LINKS.length * 0.05 + 0.15, duration: 0.3 }}
                className="pt-6 border-t border-border/70 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between px-2 pb-2">
                  <span className="text-xs font-semibold text-text-secondary">Alternar Tema</span>
                  <ThemeToggle showLabel />
                </div>

                <Link
                  href="/cliente/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#145A43] via-[#2E8B57] to-[#145A43] py-3.5 text-sm font-bold text-white shadow-[0_10px_30px_rgba(46,139,87,0.35)] border border-[rgba(110,231,183,0.3)] transition-transform duration-200 active:scale-98 cursor-pointer"
                  >
                    <span>{CTA_CLIENT_AREA}</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-transform duration-200 group-hover:translate-x-1"
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </button>
                </Link>

                <Link
                  href="/equipe"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    className="w-full rounded-xl border border-[rgba(110,231,183,0.2)] bg-card-elevated/60 py-3 text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-card-elevated transition-colors duration-200 text-center cursor-pointer"
                  >
                    {CTA_TEAM_AREA}
                  </button>
                </Link>
              </motion.div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
