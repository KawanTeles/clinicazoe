-- Etapa 37: patient_evolutions passa a aceitar 1 evolução POR PROFISSIONAL
-- vinculado à consulta (principal ou coterapeuta), não mais 1 única
-- evolução por consulta. Depende de appointment_professionals (0036).

-- A constraint original (0025_patient_evolutions.sql) foi criada como
-- coluna "unique" inline, então o Postgres gerou o nome padrão abaixo
-- (<tabela>_<coluna>_key). Se o nome real no seu banco for diferente,
-- ajuste este DROP antes de rodar — pode conferir com \d patient_evolutions.
alter table public.patient_evolutions
  drop constraint patient_evolutions_appointment_id_key;

alter table public.patient_evolutions
  add constraint patient_evolutions_appointment_professional_key
  unique (appointment_id, professional_id);

-- Validação ampliada: aceita o profissional principal da consulta OU
-- qualquer coterapeuta vinculado via appointment_professionals. A checagem
-- de paciente, status da consulta e imutabilidade em UPDATE continuam
-- iguais à versão original (0025).
create or replace function public.patient_evolutions_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  appt record;
  is_linked_professional boolean;
begin
  select professional_id, patient_id, status
    into appt
    from public.appointments
    where id = new.appointment_id;

  if appt is null then
    raise exception 'Consulta não encontrada.';
  end if;

  if new.patient_id <> appt.patient_id then
    raise exception 'A evolução deve pertencer ao paciente da consulta.';
  end if;

  is_linked_professional := new.professional_id = appt.professional_id
    or exists (
      select 1 from public.appointment_professionals ap
      where ap.appointment_id = new.appointment_id
        and ap.professional_id = new.professional_id
    );

  if not is_linked_professional then
    raise exception 'A evolução deve pertencer a um profissional vinculado à consulta.';
  end if;

  if appt.status not in ('confirmada', 'concluida') then
    raise exception 'Só é possível registrar evolução para consultas realizadas.';
  end if;

  if tg_op = 'UPDATE' then
    if new.appointment_id <> old.appointment_id
       or new.patient_id <> old.patient_id
       or new.professional_id <> old.professional_id then
      raise exception 'Não é permitido alterar a consulta, o paciente ou o profissional de uma evolução existente.';
    end if;
  end if;

  return new;
end;
$$;
-- create or replace function não exige recriar a trigger
-- patient_evolutions_validate_biu (0025) — ela já aponta para esta função
-- e passa a usar o novo corpo automaticamente.

-- Policy de INSERT ampliada: aceita o principal (regra original) OU um
-- coterapeuta vinculado.
drop policy "patient_evolutions_insert_own" on public.patient_evolutions;

create policy "patient_evolutions_insert_own"
  on public.patient_evolutions for insert
  to authenticated
  with check (
    professional_id = auth.uid()
    and created_by = auth.uid()
    and (
      exists (
        select 1 from public.appointments
        where appointments.id = appointment_id
          and appointments.professional_id = auth.uid()
      )
      or exists (
        select 1 from public.appointment_professionals
        where appointment_professionals.appointment_id = appointment_id
          and appointment_professionals.professional_id = auth.uid()
      )
    )
  );

-- patient_evolutions_select_own e patient_evolutions_update_own (0031/0025)
-- não precisam mudar: já são escopadas por professional_id = auth.uid(),
-- que continua correto seja o profissional principal ou um coterapeuta —
-- cada um só vê/edita a própria linha, sigilo profissional preservado.
