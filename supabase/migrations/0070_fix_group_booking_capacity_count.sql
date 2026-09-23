-- Etapa 70: corrige a contagem de capacidade em book_appointment() para
-- sessões conjugadas (dupla/grupo).
--
-- Bug: a checagem de capacidade contava CADA LINHA de appointments como uma
-- vaga ocupada, sem excluir as linhas do próprio grupo sendo criado. Numa
-- sessão de 2 participantes com capacity=1 (padrão de qualquer horário
-- novo), o 1º participante já preenchia a única vaga, e o 2º sempre batia
-- em SLOT_FULL — inclusive numa recorrência inteira, onde TODAS as datas
-- falhavam do mesmo jeito, mesmo com a prévia mostrando "Disponível".
--
-- A prévia (getAvailableTimes/countOccupiedByStartTime, em
-- booking-queries.ts) já fazia a contagem certa: agrupa por
-- "group_id ?? id", então uma sessão conjugada inteira sempre contou como 1
-- vaga só, não 1 por participante — dessincronizado do que o
-- book_appointment() real checava. Esta migration alinha a função do banco
-- com essa mesma regra: contagem por sessão distinta (coalesce(group_id,
-- id)), excluindo as linhas que já pertencem ao PRÓPRIO grupo sendo
-- montado (mesmo padrão de exclusão já usado logo abaixo pra PATIENT_CONFLICT).
--
-- Sem mudança de assinatura — CREATE OR REPLACE é suficiente.
create or replace function public.book_appointment(
  p_patient_id uuid,
  p_professional_id uuid,
  p_specialty_id uuid,
  p_insurance_id uuid,
  p_schedule_slot_id uuid,
  p_appointment_date date,
  p_start_time time,
  p_end_time time,
  p_payment_method text,
  p_value numeric,
  p_modality text,
  p_particular_product text,
  p_source text,
  p_group_id uuid default null,
  p_series_id uuid default null
)
returns public.appointments
language plpgsql
as $$
declare
  v_capacity int;
  v_booked_count int;
  v_appointment public.appointments;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(
      p_professional_id::text || '|' || p_appointment_date::text || '|' || p_start_time::text,
      0
    )
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_patient_id::text || '|' || p_appointment_date::text || '|' || p_start_time::text,
      1
    )
  );

  select capacity into v_capacity
  from public.schedule_slots
  where id = p_schedule_slot_id;

  if v_capacity is null then
    raise exception 'Horário não encontrado.' using errcode = 'P0001';
  end if;

  select count(distinct coalesce(group_id, id)) into v_booked_count
  from public.appointments
  where professional_id = p_professional_id
    and appointment_date = p_appointment_date
    and start_time = p_start_time
    and status in ('pendente', 'confirmada', 'concluida', 'faltou', 'faltou_justificada')
    and (p_group_id is null or group_id is distinct from p_group_id);

  if v_booked_count >= v_capacity then
    raise exception 'SLOT_FULL' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.appointments
    where patient_id = p_patient_id
      and appointment_date = p_appointment_date
      and start_time = p_start_time
      and status in ('pendente', 'confirmada', 'concluida', 'faltou', 'faltou_justificada')
      and (p_group_id is null or group_id is distinct from p_group_id)
  ) then
    raise exception 'PATIENT_CONFLICT' using errcode = 'P0001';
  end if;

  insert into public.appointments (
    patient_id, professional_id, specialty_id, insurance_id, schedule_slot_id,
    appointment_date, start_time, end_time, payment_method, value, modality,
    particular_product, status, source, group_id, series_id
  ) values (
    p_patient_id, p_professional_id, p_specialty_id, p_insurance_id, p_schedule_slot_id,
    p_appointment_date, p_start_time, p_end_time, p_payment_method, p_value, p_modality,
    p_particular_product, 'pendente', p_source, p_group_id, p_series_id
  )
  returning * into v_appointment;

  return v_appointment;
end;
$$;
