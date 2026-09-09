import type { ReactNode } from "react";

type IconPaths = () => ReactNode;

const BRAIN: IconPaths = () => (
  <>
    <path d="M12 18V5" />
    <path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4" />
    <path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5" />
    <path d="M17.997 5.125a4 4 0 0 1 2.526 5.77" />
    <path d="M18 18a4 4 0 0 0 2-7.464" />
    <path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517" />
    <path d="M6 18a4 4 0 0 1-2-7.464" />
    <path d="M6.003 5.125a4 4 0 0 0-2.526 5.77" />
  </>
);

const MIC: IconPaths = () => (
  <>
    <path d="M12 19v3" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <rect x="9" y="2" width="6" height="13" rx="3" />
  </>
);

const BOOK_OPEN: IconPaths = () => (
  <>
    <path d="M12 5v16" />
    <path d="M20.001 19A2 2 0 0 0 22 17V5a2 2 0 0 0-1.999-2L16 3.002A5 5 0 0 0 12 5a5 5 0 0 0-4-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 1.999 2H8a5 5 0 0 1 4 2 5 5 0 0 1 4-2z" />
  </>
);

const LEAF: IconPaths = () => (
  <>
    <path d="M11 20a10 10 0 0 0 10-10 25.9 25.9 0 0 0-1.04-7.281 1 1 0 0 0-1.755-.325C15.833 5.5 13 5.5 9.8 6.1A7 7 0 0 0 11 20" />
    <path d="M2 21a5 5 0 0 1 2.911-4.544C7.613 15.212 8.351 15.24 11 13" />
  </>
);

const HAND: IconPaths = () => (
  <>
    <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2" />
    <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" />
    <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
  </>
);

const DUMBBELL: IconPaths = () => (
  <>
    <path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z" />
    <path d="m2.5 21.5 1.4-1.4" />
    <path d="m20.1 3.9 1.4-1.4" />
    <path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z" />
    <path d="m9.6 14.4 4.8-4.8" />
  </>
);

const MUSIC: IconPaths = () => (
  <>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </>
);

const BABY: IconPaths = () => (
  <>
    <path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" />
    <path d="M15 12h.01" />
    <path d="M19.38 6.813A9 9 0 0 1 20.8 10.2a2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1" />
    <path d="M9 12h.01" />
  </>
);

const PUZZLE: IconPaths = () => (
  <path d="M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z" />
);

/** Ícone padrão (pulso/atividade) — usado quando o nome da especialidade não casa com nenhuma regra abaixo. */
const ACTIVITY: IconPaths = () => <path d="M22 12h-4l-3 9L9 3l-3 9H2" />;

const RULES: { test: (normalized: string) => boolean; render: IconPaths }[] = [
  { test: (n) => n.includes("fonoaudiolog") || n.includes("fono"), render: MIC },
  { test: (n) => n.includes("psicopedagog"), render: BOOK_OPEN },
  { test: (n) => n.includes("psicolog") || n.includes("psiquiatr") || n.includes("neuropsicolog"), render: BRAIN },
  { test: (n) => n.includes("nutri"), render: LEAF },
  { test: (n) => n.includes("ocupacional"), render: HAND },
  { test: (n) => n.includes("fisioterap") || n.includes("fisiatr"), render: DUMBBELL },
  { test: (n) => n.includes("musicoterap") || n.includes("musica"), render: MUSIC },
  { test: (n) => n.includes("pediatr"), render: BABY },
  { test: (n) => n.includes("aba") || n.includes("autis") || n.includes("comportamental"), render: PUZZLE },
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function pickRenderer(specialtyName: string): IconPaths {
  const normalized = normalize(specialtyName);
  return RULES.find((rule) => rule.test(normalized))?.render ?? ACTIVITY;
}

interface SpecialtyIconProps {
  name: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/**
 * Ícone de especialidade escolhido por palavra-chave no nome (vindo do
 * banco, texto livre) — sem isso, todo card de especialidade mostrava o
 * mesmo ícone genérico de pulso, independente da área. Nomes que não casam
 * com nenhuma regra caem no ícone de pulso/atividade como fallback neutro.
 */
export function SpecialtyIcon({ name, size = 20, strokeWidth = 2.2, className }: SpecialtyIconProps) {
  const render = pickRenderer(name);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {render()}
    </svg>
  );
}
