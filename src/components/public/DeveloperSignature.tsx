import React from "react";

interface DeveloperSignatureProps {
  className?: string;
}

export function DeveloperSignature({ className = "" }: DeveloperSignatureProps) {
  return (
    <div
      className={`w-full py-1 px-4 flex items-center justify-center text-center text-xs text-[#7A9187] dark:text-[#7A9187] ${className}`}
    >
      <div className="inline-flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center font-normal leading-relaxed tracking-wide">
        <span className="text-[#C8D4CF]">Site desenvolvido por</span>
        <a
          href="https://portfolio-rvm8.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          title="Ver portfólio de Kawan Teles (abre em uma nova aba)"
          className="group relative inline-flex items-center gap-1 font-bold text-[#5ED39D] dark:text-[#5ED39D] transition-all duration-300 ease-out hover:text-[#A8F5D0] hover:scale-105 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#5ED39D]/60 focus:ring-offset-2 focus:ring-offset-[#081C15] rounded px-1 py-0.5"
          style={{
            textShadow: "0 0 1px rgba(94, 211, 157, 0.2)",
          }}
        >
          {/* Subtle glow background layer on hover */}
          <span className="absolute inset-0 rounded bg-[#5ED39D]/0 transition-all duration-300 group-hover:bg-[#5ED39D]/10 group-hover:shadow-[0_0_14px_rgba(94,211,157,0.45)]" />
          
          <span className="relative z-10 underline decoration-[#5ED39D]/50 decoration-1 underline-offset-4 transition-colors duration-300 group-hover:decoration-[#A8F5D0]">
            Kawan Teles
          </span>

          {/* External Link Arrow Icon (↗) */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="relative z-10 inline-block transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 text-[#5ED39D] group-hover:text-[#A8F5D0]"
            aria-hidden="true"
          >
            <line x1="7" y1="17" x2="17" y2="7" />
            <polyline points="7 7 17 7 17 17" />
          </svg>
        </a>

        <span className="hidden sm:inline text-[#255044] font-medium mx-0.5" aria-hidden="true">
          —
        </span>

        <span className="text-[#98ADA4]">
          Conheça meu portfólio e veja outros projetos profissionais.
        </span>
      </div>
    </div>
  );
}
