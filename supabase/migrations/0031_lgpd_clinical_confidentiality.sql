-- Etapa 31: sigilo profissional / LGPD — conteúdo clínico (Evolução do
-- Paciente e Relatórios IA) passa a ser acesso exclusivo do profissional
-- responsável. O Administrador deixa de enxergar o conteúdo (mantém apenas
-- os dados administrativos da consulta, já expostos por outras queries).
--
-- Reforça o menor privilégio: admin é gestão da clínica, não prontuário.

-- patient_evolutions: remove o "ou admin" do select — só quem escreveu.
drop policy "patient_evolutions_select_own_or_admin" on public.patient_evolutions;

create policy "patient_evolutions_select_own"
  on public.patient_evolutions for select
  to authenticated
  using (professional_id = auth.uid());

-- ai_reports: mesma coisa — relatório de IA é prontuário, não gestão.
drop policy "ai_reports_select_own_or_admin" on public.ai_reports;

create policy "ai_reports_select_own"
  on public.ai_reports for select
  to authenticated
  using (professional_id = auth.uid());

delete from public.role_permissions
where (role, permission) in (
  ('admin', 'evolutions.view.all'),
  ('admin', 'ai.reports.use')
);
