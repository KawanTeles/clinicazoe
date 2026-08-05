export interface NavItem {
  label: string;
  href: string;
  permission: string;
  icon?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", permission: "dashboard.view", icon: "dashboard" },
  { label: "Agendar Consulta", href: "/book", permission: "appointments.book", icon: "calendar-plus" },
  { label: "Solicitações", href: "/requests", permission: "requests.manage", icon: "bell" },
  { label: "Minhas Consultas", href: "/appointments", permission: "appointments.view.own", icon: "calendar" },
  { label: "Consultas", href: "/appointments", permission: "appointments.manage", icon: "calendar" },
  { label: "Financeiro", href: "/financial", permission: "financial.view.own", icon: "dollar-sign" },
  { label: "Financeiro", href: "/financial", permission: "financial.manage", icon: "dollar-sign" },
  { label: "Minha Agenda", href: "/my-schedule", permission: "schedule.manage.own", icon: "clock" },
  { label: "Meus Pacientes", href: "/my-patients", permission: "patients.view.own", icon: "users" },
  { label: "Pacientes", href: "/patients", permission: "patients.manage", icon: "users" },
  { label: "Profissionais", href: "/professionals", permission: "professionals.view", icon: "user-check" },
  { label: "Equipe", href: "/team", permission: "users.manage", icon: "shield" },
  { label: "Especialidades", href: "/specialties", permission: "specialties.manage", icon: "stethoscope" },
  { label: "Convênios", href: "/insurances", permission: "insurances.manage", icon: "building" },
  { label: "Auditoria", href: "/audit", permission: "audit.view", icon: "activity" },
  { label: "Configurações", href: "/settings", permission: "settings.manage", icon: "settings" },
  { label: "Meu Perfil", href: "/profile", permission: "profile.edit.self", icon: "user" },
];

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  recepcionista: "Recepcionista",
  profissional: "Profissional",
  paciente: "Paciente",
};
