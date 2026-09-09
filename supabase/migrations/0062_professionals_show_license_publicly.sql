-- Etapa 62: permite à administradora escolher, por profissional, se o
-- registro (CRM/CRP/etc.) aparece no site público. Default true preserva o
-- comportamento atual para quem já tem license_number preenchido; o site
-- público (src/lib/public-queries.ts) para de usar o placeholder genérico
-- "CRM/Registro Ativo" quando o campo está vazio ou esta flag é false.

alter table public.professionals
  add column show_license_publicly boolean not null default true;
