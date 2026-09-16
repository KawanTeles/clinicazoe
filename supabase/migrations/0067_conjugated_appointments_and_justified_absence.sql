-- Etapa 67: atendimento conjugado (dupla/grupo/multidisciplinar) + falta
-- justificada.
--
-- Reaproveita o que já existe em vez de reescrever appointments como
-- sessões/participações: schedule_slots.capacity (0008) já permite N linhas
-- de appointments compartilhando profissional+data+hora ("grupo"), e
-- appointment_professionals (0036, coterapeutas) já permite N profissionais
-- numa mesma linha ("multidisciplinar"). O que faltava:
--   1. uma âncora leve (appointment_groups) para agrupar visualmente e criar
--      em conjunto várias linhas de appointments que formam uma mesma sessão
--      (dupla/grupo com múltiplos pacientes E múltiplos profissionais);
--   2. falta justificada (novo valor de status + motivo), inclusive por
--      coterapeuta, já que hoje appointments.status é único por linha,
--      compartilhado entre principal e coterapeutas;
--   3. checagem de conflito de agenda por paciente, que hoje não existe nem
--      no fluxo simples (só a capacidade do profissional é checada).

-- 1) Novo status: falta justificada. Mesmo padrão de 0020 (drop+add da check
-- constraint nomeada). Falta justificada ainda ocupou a vaga do horário —
-- ver ajuste de ACTIVE_APPOINTMENT_STATUSES equivalente no app e no RPC
-- abaixo.
alter table public.appointments drop constraint appointments_status_check;
alter table public.appointments add constraint appointments_status_check
  check (status in (
    'pendente', 'confirmada', 'cancelada', 'remarcada', 'concluida',
    'faltou', 'recusada', 'faltou_justificada'
  ));

-- Motivo da falta (normal ou justificada) do profissional principal desta
-- linha. Nullable — só preenchido quando status é faltou/faltou_justificada.
alter table public.appointments add column absence_reason text;

-- 2) Âncora de sessão conjugada. Só guarda data/hora (replicados aqui para
-- permitir checagem via trigger, sem precisar olhar as linhas de
-- appointments) e quem criou. Nenhuma identidade de paciente/profissional
-- mora aqui — essas continuam em appointments/appointment_professionals.
create table public.appointment_groups (
  id uuid primary key default gen_random_uuid(),
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

alter table public.appointment_groups enable row level security;

-- Sem policy de insert/update/delete para authenticated: o grupo nasce e
-- morre só via service role, dentro da Server Action que cria o atendimento
-- conjugado (mesmo padrão de book_appointment/financial_entries). A policy
-- de SELECT vem depois de appointments.group_id existir (ver abaixo) — ela
-- referencia essa coluna.

-- 3) appointments.group_id — nullable; null preserva 100% do comportamento
-- atual (atendimento simples ou grupo "implícito" via capacity, sem UI de
-- criação conjunta).
alter table public.appointments
  add column group_id uuid references public.appointment_groups (id) on delete set null;

create index appointments_group_idx on public.appointments (group_id);

-- SELECT de appointment_groups: staff sempre; qualquer profissional
-- vinculado (principal ou coterapeuta, via is_appointment_cotherapist de
-- 0040) a alguma linha do grupo. Nenhum nome de paciente é exposto por esta
-- tabela em si — só a existência do grupo e seu horário. Precisa vir depois
-- de appointments.group_id (acima) existir.
create policy "appointment_groups_select"
  on public.appointment_groups for select
  to authenticated
  using (
    public.is_admin()
    or public.current_role() = 'recepcionista'
    or exists (
      select 1 from public.appointments a
      where a.group_id = appointment_groups.id
        and (a.professional_id = auth.uid() or public.is_appointment_cotherapist(a.id))
    )
  );

-- Garante que uma linha nunca fique "no grupo errado": data/hora da linha
-- precisam bater com as do grupo ao vincular.
create or replace function public.appointments_validate_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group record;
begin
  if new.group_id is null then
    return new;
  end if;

  select appointment_date, start_time, end_time into v_group
  from public.appointment_groups
  where id = new.group_id;

  if v_group is null then
    raise exception 'Sessão conjugada não encontrada.';
  end if;

  if new.appointment_date <> v_group.appointment_date
     or new.start_time <> v_group.start_time
     or new.end_time <> v_group.end_time then
    raise exception 'Data/horário do atendimento não corresponde ao da sessão conjugada.';
  end if;

  return new;
end;
$$;

create trigger appointments_validate_group_biu
  before insert or update on public.appointments
  for each row execute function public.appointments_validate_group();

-- 4) Falta por participação do coterapeuta — independente do status da
-- linha principal (que continua sendo o "dono" oficial do agendamento).
-- Nula = coterapeuta não teve falta registrada nesta participação.
alter table public.appointment_professionals
  add column absence_status text
    check (absence_status in ('faltou', 'faltou_justificada')),
  add column absence_reason text;

-- 0036 deixou a tabela sem policy de UPDATE ("vínculo é imutável"). Agora
-- passa a admitir UPDATE, mas só do próprio profissional (falta é autoral,
-- mesmo espírito de patient_evolutions) ou de staff — decisão confirmada:
-- o principal da consulta NÃO marca falta pelo coterapeuta, só o próprio
-- coterapeuta ou admin/recepcionista. Restrito a esses dois campos novos —
-- o trigger abaixo reforça isso mesmo que a policy seja contornada.
create policy "appointment_professionals_update_absence"
  on public.appointment_professionals for update
  to authenticated
  using (
    professional_id = auth.uid()
    or public.is_admin()
    or public.current_role() = 'recepcionista'
  )
  with check (
    professional_id = auth.uid()
    or public.is_admin()
    or public.current_role() = 'recepcionista'
  );

create or replace function public.appointment_professionals_prevent_tampering()
returns trigger
language plpgsql
as $$
begin
  if new.appointment_id <> old.appointment_id
     or new.professional_id <> old.professional_id
     or new.created_at <> old.created_at
     or new.created_by is distinct from old.created_by then
    raise exception 'Só é possível alterar o status de falta deste vínculo.';
  end if;

  return new;
end;
$$;

create trigger appointment_professionals_prevent_tampering_bu
  before update on public.appointment_professionals
  for each row execute function public.appointment_professionals_prevent_tampering();

-- 4b) prevent_appointment_tampering (0009/0013/0018/0024/0064) só liberava a
-- transição do profissional principal para o status 'faltou' — sem este
-- ajuste, marcar 'faltou_justificada' pelo próprio profissional cairia no
-- branch genérico de baixo e seria barrado com "Não autorizado.". Staff
-- (admin/recepcionista) já não passa por essa checagem (early return),
-- então não é afetado. Corpo idêntico ao de 0064, só trocando a comparação
-- de status por um IN.
create or replace function public.prevent_appointment_tampering()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() or public.current_role() = 'recepcionista' then
    return new;
  end if;

  if old.professional_id = auth.uid()
     and old.status in ('pendente', 'confirmada')
     and new.status in ('faltou', 'faltou_justificada') then
    if new.patient_id <> old.patient_id
       or new.professional_id <> old.professional_id
       or new.value <> old.value
       or new.appointment_date <> old.appointment_date
       or new.start_time <> old.start_time
       or new.insurance_id <> old.insurance_id
       or new.payment_method <> old.payment_method
       or new.modality is distinct from old.modality
       or new.particular_product is distinct from old.particular_product then
      raise exception 'Você só pode marcar falta neste atendimento.';
    end if;
    return new;
  end if;

  if old.professional_id = auth.uid() and old.series_id is not null then
    if new.patient_id <> old.patient_id
       or new.professional_id <> old.professional_id
       or new.value <> old.value
       or new.insurance_id <> old.insurance_id
       or new.payment_method <> old.payment_method
       or new.modality is distinct from old.modality
       or new.particular_product is distinct from old.particular_product then
      raise exception 'Você só pode alterar data/horário desta consulta.';
    end if;
    return new;
  end if;

  if old.patient_id <> auth.uid() then
    raise exception 'Não autorizado.';
  end if;

  if new.status not in ('cancelada', 'remarcada') then
    raise exception 'Você só pode cancelar ou remarcar sua própria consulta.';
  end if;

  if new.patient_id <> old.patient_id
     or new.professional_id <> old.professional_id
     or new.value <> old.value
     or new.appointment_date <> old.appointment_date
     or new.start_time <> old.start_time
     or new.modality is distinct from old.modality
     or new.particular_product is distinct from old.particular_product then
    raise exception 'Alteração não permitida.';
  end if;

  return new;
end;
$$;

-- 5) book_appointment() — mesma assinatura de 0066 + p_group_id opcional,
-- falta justificada na lista de status que ocupam vaga, e checagem NOVA de
-- conflito por paciente (que hoje não existe nem no fluxo simples). Lock
-- separado do lock de profissional (salt 1 em vez de 0) para não colidir.
-- Dentro de um mesmo grupo o paciente pode repetir (rede de segurança; a
-- Server Action de criação de grupo nunca produz esse caso, já que
-- multi-profissional para o mesmo paciente sempre vira coterapeuta numa
-- única linha, não uma segunda linha).
--
-- Acrescentar um parâmetro (mesmo com default) muda a identidade da função
-- para o Postgres (identidade = nome + tipos dos parâmetros de entrada) —
-- "create or replace" NÃO substituiria a versão de 13 parâmetros de 0066,
-- criaria uma segunda sobrecarga ambígua para chamadas com 13 argumentos.
-- Precisa derrubar a assinatura antiga explicitamente antes de recriar.
drop function if exists public.book_appointment(
  uuid, uuid, uuid, uuid, uuid, date, time, time, text, numeric, text, text, text
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
  p_group_id uuid default null
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

  -- Mesma lista de status "ativos" usada em booking-queries.ts
  -- (ACTIVE_APPOINTMENT_STATUSES) — cancelada/remarcada/recusada liberam o
  -- horário, os outros ocupam vaga. faltou_justificada ocupa vaga igual
  -- faltou (a sessão aconteceu/estava marcada, só o comparecimento mudou).
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
    particular_product, status, source, group_id
  ) values (
    p_patient_id, p_professional_id, p_specialty_id, p_insurance_id, p_schedule_slot_id,
    p_appointment_date, p_start_time, p_end_time, p_payment_method, p_value, p_modality,
    p_particular_product, 'pendente', p_source, p_group_id
  )
  returning * into v_appointment;

  return v_appointment;
end;
$$;

grant execute on function public.book_appointment(
  uuid, uuid, uuid, uuid, uuid, date, time, time, text, numeric, text, text, text, uuid
) to authenticated, service_role;
