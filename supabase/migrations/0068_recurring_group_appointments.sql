-- Etapa 68: recorrência para atendimento conjugado (dupla/grupo/
-- multidisciplinar) — reaproveita appointment_series (0018) em vez de criar
-- um mecanismo paralelo. appointment_series continua representando o
-- "participante 1" (paciente+profissional principal), exatamente como hoje;
-- as duas tabelas novas abaixo só existem quando a recorrência é de uma
-- sessão conjugada — vazias, o caso simples fica 100% inalterado.

-- 1) book_appointment() — mesma assinatura de 0067 + p_series_id opcional,
-- gravando series_id no INSERT junto com group_id. Isso permite migrar a
-- criação de ocorrências recorrentes (hoje INSERT direto em
-- recurrence-actions.ts) para passar pelo lock atômico + checagem de
-- conflito por paciente que só a RPC tem — fechando essa lacuna também pra
-- recorrência, não só pro agendamento avulso.
--
-- Mesmo cuidado de identidade de função de 0067: acrescentar um parâmetro
-- muda a identidade pro Postgres, precisa derrubar a assinatura de 14
-- parâmetros antes de recriar.
drop function if exists public.book_appointment(
  uuid, uuid, uuid, uuid, uuid, date, time, time, text, numeric, text, text, text, uuid
);

create function public.book_appointment(
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

  select count(*) into v_booked_count
  from public.appointments
  where professional_id = p_professional_id
    and appointment_date = p_appointment_date
    and start_time = p_start_time
    and status in ('pendente', 'confirmada', 'concluida', 'faltou', 'faltou_justificada');

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

grant execute on function public.book_appointment(
  uuid, uuid, uuid, uuid, uuid, date, time, time, text, numeric, text, text, text, uuid, uuid
) to authenticated, service_role;

-- 2) Molde dos participantes adicionais de uma série conjugada (o
-- "participante 1" já está em appointment_series.patient_id/insurance_id/
-- payment_method/modality/particular_product — aqui só entram os EXTRAS).
create table public.appointment_series_participants (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.appointment_series (id) on delete cascade,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  insurance_id uuid not null references public.insurances (id) on delete restrict,
  payment_method text not null
    check (payment_method in ('cartao', 'pix', 'dinheiro', 'convenio')),
  modality text check (modality in ('aba', 'comum')),
  particular_product text check (particular_product in ('consulta', 'pacote')),
  created_at timestamptz not null default now()
);

create index appointment_series_participants_series_idx
  on public.appointment_series_participants (series_id);

alter table public.appointment_series_participants enable row level security;

-- Mesma visibilidade de appointment_series (0018): staff sempre, ou o
-- profissional principal da série. Sem policy de insert/update/delete pra
-- authenticated — quem cria uma série conjugada é sempre staff, via Server
-- Action com service role (mesmo padrão de appointment_groups/financial_entries).
create policy "appointment_series_participants_select"
  on public.appointment_series_participants for select
  to authenticated
  using (
    public.is_admin()
    or public.current_role() = 'recepcionista'
    or exists (
      select 1 from public.appointment_series s
      where s.id = series_id and s.professional_id = auth.uid()
    )
  );

-- 3) Coterapeutas fixos do padrão de recorrência — vinculados a TODAS as
-- linhas de TODAS as ocorrências geradas (mesmo espírito "grupo coletivo
-- sem dono" de appointment_professionals/0036, só que no nível do molde).
create table public.appointment_series_cotherapists (
  series_id uuid not null references public.appointment_series (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  primary key (series_id, professional_id)
);

alter table public.appointment_series_cotherapists enable row level security;

create policy "appointment_series_cotherapists_select"
  on public.appointment_series_cotherapists for select
  to authenticated
  using (
    public.is_admin()
    or public.current_role() = 'recepcionista'
    or exists (
      select 1 from public.appointment_series s
      where s.id = series_id and s.professional_id = auth.uid()
    )
  );
