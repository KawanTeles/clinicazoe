-- Corrige condição de corrida na criação de agendamento: hoje a aplicação
-- faz um SELECT de disponibilidade e só depois o INSERT (createAppointment,
-- createAppointmentForPatient em booking-actions.ts; createPublicAppointment
-- em public-booking-actions.ts). Se duas requisições para o mesmo
-- profissional+data+horário chegam ao mesmo tempo (ex.: dois
-- admins/recepcionistas confirmando o mesmo horário), as duas checagens
-- podem passar antes de qualquer um dos dois INSERTs acontecer, e o sistema
-- aceita os dois agendamentos conflitantes — clássico TOCTOU (time-of-check
-- to time-of-use).
--
-- Por que não uma UNIQUE constraint simples em
-- (professional_id, appointment_date, start_time): schedule_slots.capacity
-- (0008_pricing_and_capacity) permite mais de um agendamento ativo no mesmo
-- horário pro mesmo profissional (ex.: atendimento em grupo; ajustável pelo
-- admin em Horários, ScheduleManager.tsx). A regra real de negócio é "no
-- máximo `capacity` agendamentos ativos por horário", não "no máximo 1" —
-- uma UNIQUE de 1 quebraria esse recurso silenciosamente. A garantia
-- correta precisa contar quantos agendamentos ativos já existem pro slot e
-- comparar com a capacidade, de forma atômica.
--
-- book_appointment() faz essa checagem+insert dentro de uma única chamada,
-- serializada por pg_advisory_xact_lock: a chave do lock é o hash de
-- profissional+data+horário (o "slot" disputado). Enquanto uma chamada está
-- entre o lock e o fim da transação, qualquer outra chamada concorrente
-- para a MESMA chave fica bloqueada esperando; quando é liberada, o count()
-- já reflete o INSERT anterior. O lock é de transação (xact) — liberado
-- automaticamente no commit/rollback da própria chamada RPC, sem precisar
-- de unlock manual. Isso é a fonte de verdade; a checagem de disponibilidade
-- que a aplicação já faz antes de chamar esta função continua existindo,
-- só que agora só serve pra dar feedback rápido — quem garante a
-- consistência é o banco.
--
-- SECURITY INVOKER (padrão do Postgres — não declarado abaixo): o INSERT
-- dentro da função roda com o papel de quem chamou, então continua sujeito
-- às mesmas RLS policies de sempre (appointments_insert_patient_own exige
-- patient_id = auth.uid() e status = 'pendente' pra sessão de paciente).
-- Chamadas via service role (agendamento público em
-- public-booking-actions.ts, e agendamento pela equipe em
-- createAppointmentForPatient) continuam bypassando RLS como já faziam —
-- esta função não amplia nem reduz quem pode inserir o quê.
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
  p_source text
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

  select capacity into v_capacity
  from public.schedule_slots
  where id = p_schedule_slot_id;

  if v_capacity is null then
    raise exception 'Horário não encontrado.' using errcode = 'P0001';
  end if;

  -- Mesma lista de status "ativos" usada em booking-queries.ts
  -- (ACTIVE_APPOINTMENT_STATUSES) — cancelada/remarcada/recusada liberam o
  -- horário, os outros ocupam vaga.
  select count(*) into v_booked_count
  from public.appointments
  where professional_id = p_professional_id
    and appointment_date = p_appointment_date
    and start_time = p_start_time
    and status in ('pendente', 'confirmada', 'concluida', 'faltou');

  if v_booked_count >= v_capacity then
    raise exception 'SLOT_FULL' using errcode = 'P0001';
  end if;

  insert into public.appointments (
    patient_id, professional_id, specialty_id, insurance_id, schedule_slot_id,
    appointment_date, start_time, end_time, payment_method, value, modality,
    particular_product, status, source
  ) values (
    p_patient_id, p_professional_id, p_specialty_id, p_insurance_id, p_schedule_slot_id,
    p_appointment_date, p_start_time, p_end_time, p_payment_method, p_value, p_modality,
    p_particular_product, 'pendente', p_source
  )
  returning * into v_appointment;

  return v_appointment;
end;
$$;

grant execute on function public.book_appointment(
  uuid, uuid, uuid, uuid, uuid, date, time, time, text, numeric, text, text, text
) to authenticated, service_role;
