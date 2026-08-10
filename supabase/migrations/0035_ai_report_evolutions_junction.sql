-- Etapa 35: integridade referencial entre ai_reports e patient_evolutions.
--
-- ai_reports.evolution_ids era um array solto (uuid[]), sem FK — nada
-- garantia que os ids ali dentro apontassem para evoluções existentes, nem
-- que fossem do mesmo paciente/profissional do relatório. Esta migration
-- adiciona uma tabela de junção com FK real para as duas pontas.
--
-- Não é destrutiva: a coluna evolution_ids permanece intacta (continua
-- sendo a fonte usada pelas leituras existentes em reports-queries.ts) e o
-- histórico já existente é copiado para a tabela nova via backfill abaixo.
-- A aplicação passa a escrever nas duas em paralelo a partir de agora.

create table public.ai_report_evolutions (
  report_id uuid not null references public.ai_reports (id) on delete cascade,
  evolution_id uuid not null references public.patient_evolutions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (report_id, evolution_id)
);

create index ai_report_evolutions_evolution_idx
  on public.ai_report_evolutions (evolution_id);

alter table public.ai_report_evolutions enable row level security;

-- Valida, em insert, que a evolução vinculada pertence ao mesmo paciente e
-- ao mesmo profissional do relatório (evita vincular evolução de outro
-- paciente por erro de aplicação). Mesmo espírito de
-- patient_evolutions_validate (0025_patient_evolutions.sql).
create or replace function public.ai_report_evolutions_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report_patient uuid;
  v_report_professional uuid;
  v_evolution_patient uuid;
  v_evolution_professional uuid;
begin
  select patient_id, professional_id
    into v_report_patient, v_report_professional
    from public.ai_reports
    where id = new.report_id;

  if v_report_patient is null then
    raise exception 'Relatório não encontrado.';
  end if;

  select patient_id, professional_id
    into v_evolution_patient, v_evolution_professional
    from public.patient_evolutions
    where id = new.evolution_id;

  if v_evolution_patient is null then
    raise exception 'Evolução não encontrada.';
  end if;

  if v_evolution_patient <> v_report_patient or v_evolution_professional <> v_report_professional then
    raise exception 'A evolução não pertence ao mesmo paciente/profissional do relatório.';
  end if;

  return new;
end;
$$;

create trigger ai_report_evolutions_validate_bi
  before insert on public.ai_report_evolutions
  for each row execute function public.ai_report_evolutions_validate();

-- Mesma regra de visibilidade do relatório-pai: só o profissional dono
-- enxerga o vínculo (admin não vê conteúdo clínico desde a 0031).
create policy "ai_report_evolutions_select_own"
  on public.ai_report_evolutions for select
  to authenticated
  using (
    exists (
      select 1 from public.ai_reports r
      where r.id = report_id and r.professional_id = auth.uid()
    )
  );

create policy "ai_report_evolutions_insert_own"
  on public.ai_report_evolutions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.ai_reports r
      where r.id = report_id and r.professional_id = auth.uid()
    )
  );

-- Sem policy de update/delete: o vínculo é imutável, igual ao relatório e à
-- evolução que ele referencia (histórico nunca é apagado pela aplicação).

-- Backfill do histórico já existente. Ignora ids órfãos ou que não batem
-- com o paciente/profissional do relatório (proteção extra para a migration
-- não falhar; hoje não deveria haver nenhum caso assim).
insert into public.ai_report_evolutions (report_id, evolution_id)
select r.id, ev.evolution_id
from public.ai_reports r
cross join lateral unnest(r.evolution_ids) as ev(evolution_id)
where exists (
  select 1 from public.patient_evolutions pe
  where pe.id = ev.evolution_id
    and pe.patient_id = r.patient_id
    and pe.professional_id = r.professional_id
)
on conflict do nothing;
