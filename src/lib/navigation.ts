export interface NavItem {
  label: string;
  href: string;
  permission: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", permission: "dashboard.view" },
  { label: "Agendar Consulta", href: "/book", permission: "appointments.book" },
  { label: "Minhas Consultas", href: "/appointments", permission: "appointments.view.own" },
  { label: "Consultas", href: "/appointments", permission: "appointments.manage" },
  { label: "Financeiro", href: "/financial", permission: "financial.view.own" },
  { label: "Financeiro", href: "/financial", permission: "financial.manage" },
  { label: "Minha Agenda", href: "/my-schedule", permission: "schedule.manage.own" },
  { label: "Meus Pacientes", href: "/my-patients", permission: "patients.view.own" },
  { label: "Profissionais", href: "/professionals", permission: "professionals.view" },
  { label: "Equipe", href: "/team", permission: "users.manage" },
  { label: "Especialidades", href: "/specialties", permission: "specialties.manage" },
  { label: "Convênios", href: "/insurances", permission: "insurances.manage" },
  { label: "Auditoria", href: "/audit", permission: "audit.view" },
  { label: "Configurações", href: "/settings", permission: "settings.manage" },
  { label: "Meu Perfil", href: "/profile", permission: "profile.edit.self" },
];

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  recepcionista: "Recepcionista",
  profissional: "Profissional",
  paciente: "Paciente",
};
