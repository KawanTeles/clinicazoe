export interface NavItem {
  label: string;
  href: string;
  permission: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", permission: "dashboard.view" },
  { label: "Profissionais", href: "/professionals", permission: "professionals.view" },
  { label: "Equipe", href: "/team", permission: "users.manage" },
  { label: "Especialidades", href: "/specialties", permission: "specialties.manage" },
  { label: "Convênios", href: "/insurances", permission: "insurances.manage" },
  { label: "Auditoria", href: "/audit", permission: "audit.view" },
  { label: "Meu Perfil", href: "/profile", permission: "profile.edit.self" },
];

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  recepcionista: "Recepcionista",
  profissional: "Profissional",
  paciente: "Paciente",
};
