export interface NavItem {
  label: string;
  href: string;
  permission: string;
  icon?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", permission: "dashboard.view", icon: "dashboard" },
  { label: "Agenda", href: "/schedule", permission: "appointments.view.own", icon: "calendar" },
  { label: "Agenda", href: "/schedule", permission: "appointments.manage", icon: "calendar" },
  { label: "Alterações da Agenda", href: "/schedule/changes", permission: "schedule.changes.view", icon: "activity" },
  { label: "Alterações da Agenda", href: "/schedule/changes", permission: "schedule.changes.view.own", icon: "activity" },
  { label: "Solicitações", href: "/requests", permission: "requests.manage", icon: "bell" },
  { label: "Lista de Espera", href: "/waitlist", permission: "waitlist.manage", icon: "waitlist" },
  { label: "Meus Atendimentos", href: "/appointments", permission: "appointments.view.own", icon: "calendar" },
  { label: "Atendimentos", href: "/appointments", permission: "appointments.manage", icon: "calendar" },
  { label: "Faltas", href: "/faltas", permission: "attendance.absences.view", icon: "user-x" },
  { label: "Financeiro", href: "/financial", permission: "financial.view.own", icon: "dollar-sign" },
  { label: "Financeiro", href: "/financial", permission: "financial.manage", icon: "dollar-sign" },
  { label: "Minha Agenda", href: "/my-schedule", permission: "schedule.manage.own", icon: "clock" },
  { label: "Meus Pacientes", href: "/my-patients", permission: "patients.view.own", icon: "users" },
  { label: "Pacientes", href: "/patients", permission: "patients.manage", icon: "users" },
  { label: "Profissionais", href: "/professionals", permission: "professionals.view", icon: "user-check" },
  { label: "Equipe", href: "/team", permission: "users.manage", icon: "shield" },
  { label: "Usuários", href: "/users", permission: "users.manage", icon: "users" },
  { label: "Especialidades", href: "/specialties", permission: "specialties.manage", icon: "stethoscope" },
  { label: "Convênios", href: "/insurances", permission: "insurances.manage", icon: "building" },
  { label: "Categorias Financeiras", href: "/financial-categories", permission: "financial.categories.manage", icon: "dollar-sign" },
  { label: "Evolução do Paciente", href: "/evolutions", permission: "evolutions.view.own", icon: "clipboard" },
  { label: "Modelos de Evolução", href: "/evolution-templates", permission: "evolution_templates.manage.own", icon: "clipboard" },
  { label: "Modelos de Evolução", href: "/evolution-templates", permission: "evolution_templates.manage.shared", icon: "clipboard" },
  { label: "Acompanhamento de Evoluções", href: "/evolution-tracking", permission: "evolution_tracking.view", icon: "activity" },
  { label: "Termo de Consentimento", href: "/consent-template", permission: "consent_templates.manage", icon: "shield" },
  { label: "Protocolos de Avaliação", href: "/protocol-templates", permission: "protocol_templates.manage.own", icon: "clipboard" },
  { label: "Protocolos de Avaliação", href: "/protocol-templates", permission: "protocol_templates.manage.shared", icon: "clipboard" },
  { label: "Liberações de Anexos", href: "/attachment-grants", permission: "attachment_grants.manage_inactive", icon: "shield" },
  { label: "Relatórios IA", href: "/reports", permission: "ai.reports.use", icon: "sparkles" },
  { label: "Auditoria", href: "/audit", permission: "audit.view", icon: "activity" },
  { label: "Configurações", href: "/settings", permission: "settings.view", icon: "settings" },
  { label: "Meu Perfil", href: "/profile", permission: "profile.edit.self", icon: "user" },
];

/** Filtra NAV_ITEMS pelas permissões do usuário e deduplica destino repetido
 * (ver comentário em app/(admin)/layout.tsx sobre o acúmulo terapeuta +
 * coordenação). Compartilhado entre o layout (sidebar desktop) e a tela
 * "Mais" do menu mobile — mesmo cálculo, duas vitrines diferentes. */
export function resolveNavItems(permissions: Set<string>): NavItem[] {
  const vistos = new Set<string>();
  return NAV_ITEMS.filter((item) => {
    if (!permissions.has(item.permission)) return false;
    const chave = `${item.href}|${item.label}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  recepcionista: "Recepcionista",
  profissional: "Profissional",
  paciente: "Paciente",
  coordenacao: "Coordenação",
};
