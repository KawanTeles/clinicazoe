-- Parte 3 do pedido "lentidão/valor opcional/lançamento manual": permite
-- lançar na agenda atendimentos que já estavam marcados à mão (fora do
-- sistema) como agendamentos JÁ EXISTENTES — avulso (toggle no formulário de
-- agendamento da equipe) ou em lote (importação por CSV) — sem os efeitos
-- colaterais de um agendamento novo (notificação/som de "nova solicitação",
-- e-mail/WhatsApp ao paciente, contagem como solicitação pendente).

-- 1) Novo valor de `source`: hoje só 'paciente' | 'site_publico' | 'staff'.
-- A tela de Solicitações (request-queries.ts, REQUEST_SOURCES) já filtra só
-- 'paciente'/'site_publico' — 'importado' nunca aparece lá, sem precisar de
-- nenhum filtro novo.
alter table public.appointments
  drop constraint appointments_source_check;

alter table public.appointments
  add constraint appointments_source_check
  check (source in ('paciente', 'site_publico', 'staff', 'importado'));

-- 2) Lote de importação — permite agrupar N linhas de uma mesma planilha
-- importada de uma vez (ou um lançamento avulso também vira um "lote" de 1
-- linha, pelo mesmo motivo) pra poder desfazer tudo de uma vez e auditar
-- quem importou o quê.
create table public.appointment_import_batches (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  row_count integer not null default 0,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  undone_at timestamptz,
  undone_by uuid references public.profiles(id)
);

comment on table public.appointment_import_batches is
  'Lotes de lançamento de atendimentos já existentes (avulso ou importação em CSV) — permite desfazer tudo de uma vez e auditar.';

alter table public.appointment_import_batches enable row level security;

-- Só leitura via RLS (listar histórico de lotes) — toda escrita (criar lote,
-- marcar como desfeito) passa por service role nas Server Actions, mesmo
-- padrão já usado em appointments/financial_entries (sem policy de INSERT
-- porque staff não tem INSERT direto nessas tabelas, só via RPC/admin client).
create policy appointment_import_batches_select on public.appointment_import_batches
  for select
  using (is_admin() or "current_role"() = 'recepcionista');

-- 3) Cada appointment importado/lançado manualmente fica ligado ao lote que
-- o criou — filtro/auditoria ("Origem: Importado") e desfazer em lote.
alter table public.appointments
  add column import_batch_id uuid references public.appointment_import_batches(id) on delete set null;

create index appointments_import_batch_idx on public.appointments(import_batch_id) where import_batch_id is not null;

-- 4) book_appointment ganha dois parâmetros novos, ambos com default pra não
-- quebrar nenhuma chamada existente (CREATE OR REPLACE, mesma assinatura +
-- novos params no final, mesmo padrão da migração 0070):
--   p_status: hoje a função SEMPRE grava 'pendente', mesmo pra agendamento
--   feito pela equipe. Lançamento de atendimento já existente precisa nascer
--   direto em 'confirmada'/'concluida'/'faltou'/'faltou_justificada' (igual
--   ao combinado: "entram diretamente confirmados, sem aparecer como
--   solicitação pendente").
--   p_import_batch_id: liga a linha criada ao lote (null = comportamento
--   atual, agendamento normal).
drop function if exists public.book_appointment(
  uuid, uuid, uuid, uuid, uuid, date, time, time, text, numeric, text, text, text, uuid, uuid
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
  p_series_id uuid default null,
  p_status text default 'pendente',
  p_import_batch_id uuid default null
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
    particular_product, status, source, group_id, series_id, import_batch_id
  ) values (
    p_patient_id, p_professional_id, p_specialty_id, p_insurance_id, p_schedule_slot_id,
    p_appointment_date, p_start_time, p_end_time, p_payment_method, p_value, p_modality,
    p_particular_product, coalesce(p_status, 'pendente'), p_source, p_group_id, p_series_id,
    p_import_batch_id
  )
  returning * into v_appointment;

  return v_appointment;
end;
$$;

grant execute on function public.book_appointment(
  uuid, uuid, uuid, uuid, uuid, date, time, time, text, numeric, text, text, text, uuid, uuid, text, uuid
) to authenticated, service_role;
