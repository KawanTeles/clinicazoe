import type { Metadata } from "next";

// Área do paciente: conteúdo privado por usuário, sem valor de busca.
// Páginas filhas (login, signup, agendar, dashboard) herdam este robots
// por não redefinirem o campo.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
