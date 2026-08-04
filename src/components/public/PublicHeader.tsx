"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

interface PublicHeaderProps {
  clinicName: string;
}

export function PublicHeader({ clinicName }: PublicHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[#255044]/60 bg-[#17382D]/85 backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-forest text-sm font-extrabold text-white shadow-[0_0_20px_rgba(46,139,87,0.3)] group-hover:scale-105 transition-transform">
            CZ
          </div>
          <span className="text-xl font-black tracking-tight text-[#F5F7F6] group-hover:text-[#5ED39D] transition-colors">
            {clinicName}
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-[#C8D4CF]">
          <Link href="/" className="hover:text-[#5ED39D] transition-colors">
            Início
          </Link>
          <Link href="/clinica" className="hover:text-[#5ED39D] transition-colors">
            A Clínica
          </Link>
          <Link href="/especialidades" className="hover:text-[#5ED39D] transition-colors">
            Especialidades
          </Link>
          <Link href="/profissionais" className="hover:text-[#5ED39D] transition-colors">
            Profissionais
          </Link>
          <Link href="/convenios" className="hover:text-[#5ED39D] transition-colors">
            Convênios
          </Link>
          <Link href="/contato" className="hover:text-[#5ED39D] transition-colors">
            Contato
          </Link>
        </nav>

        {/* Action Buttons */}
        <div className="hidden lg:flex items-center gap-3">
          <Link href="/cliente/login">
            <Button size="sm" className="shadow-[0_8px_25px_rgba(20,90,67,0.3)] font-semibold">
              Área do Cliente
            </Button>
          </Link>
          <Link href="/equipe">
            <Button variant="secondary" size="sm" className="font-semibold">
              Área da Equipe
            </Button>
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          aria-label="Menu principal"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-[#255044] bg-[#102A22] text-[#F5F7F6]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {mobileMenuOpen ? (
              <line x1="18" y1="6" x2="6" y2="18" />
            ) : (
              <>
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-[#255044] bg-[#081C15] px-6 py-6 space-y-4 animate-fade-up">
          <nav className="flex flex-col gap-3.5 text-base font-semibold text-[#C8D4CF]">
            <Link href="/" onClick={() => setMobileMenuOpen(false)} className="hover:text-[#5ED39D]">
              Início
            </Link>
            <Link href="/clinica" onClick={() => setMobileMenuOpen(false)} className="hover:text-[#5ED39D]">
              A Clínica
            </Link>
            <Link href="/especialidades" onClick={() => setMobileMenuOpen(false)} className="hover:text-[#5ED39D]">
              Especialidades
            </Link>
            <Link href="/profissionais" onClick={() => setMobileMenuOpen(false)} className="hover:text-[#5ED39D]">
              Profissionais
            </Link>
            <Link href="/convenios" onClick={() => setMobileMenuOpen(false)} className="hover:text-[#5ED39D]">
              Convênios
            </Link>
            <Link href="/contato" onClick={() => setMobileMenuOpen(false)} className="hover:text-[#5ED39D]">
              Contato
            </Link>
          </nav>
          <div className="flex flex-col gap-3 pt-4 border-t border-[#255044]">
            <Link href="/cliente/login" onClick={() => setMobileMenuOpen(false)}>
              <Button size="lg" className="w-full font-bold">
                Área do Cliente
              </Button>
            </Link>
            <Link href="/equipe" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="secondary" size="lg" className="w-full font-bold">
                Área da Equipe
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
