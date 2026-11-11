-- Etapa 76: Agenda por Profissional — bloqueios intra-dia tipados (Almoço,
-- Não Agendar, Reunião, Reposição, Sublocação/Outro), cor por convênio pra
-- legenda da grade, log estruturado de alterações de agenda (histórico +
-- base pra notificação agrupada) e permissão do profissional editar o
-- próprio atendimento avulso (hoje só marca falta, ver 0064/0074).

-- ---------------------------------------------------------------------------
-- Cor por convênio (legenda da grade, estilo planilha)
-- ---------------------------------------------------------------------------
alter table public.insurances
  add column color text;

-- ---------------------------------------------------------------------------
-- schedule_blocks — bloqueios intra-dia. "Livre" não tem linha (é a ausência
-- de bloqueio/atendimento naquele horário). Nunca gera linha em appointments,
-- financial_entries nem conta falta — só é consultado junto na grade.
-- ---------------------------------------------------------------------------
create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  block_type text not null
    check (block_type in ('almoco', 'nao_agendar', 'reuniao', 'reposicao', 'sublocacao', 'outro')),
  day_of_week smallint check (day_of_week between 0 and 6),
  specific_date date,
  start_time time not null,
  end_time time not null,
  label text,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  -- Exatamente um dos dois: recorrente semanal (day_of_week) OU pontual
  -- numa data específica (specific_date), nunca os dois nem nenhum.
  check ((day_of_week is not null) <> (specific_date is not null))
);

alter table public.schedule_blocks enable row level security;

create trigger schedule_blocks_set_updated_at
  before update on public.schedule_blocks
  for each row execute function public.set_updated_at();

create index schedule_blocks_professional_day_idx
  on public.schedule_blocks (professional_id, day_of_week);

create index schedule_blocks_professional_date_idx
  on public.schedule_blocks (professional_id, specific_date);

-- Mesma visibilidade/escrita de schedule_slots (0004/0014): todo mundo
-- autenticado vê bloqueios ativos (precisa aparecer na agenda pra quem olha
-- de fora, tipo recepção agendando outro profissional); só admin ou o
-- próprio profissional dono cria/edita/apaga.
create policy "schedule_blocks_select"
  on public.schedule_blocks for select
  to authenticated
  using (status = 'active' or public.is_admin() or professional_id = auth.uid());

create policy "schedule_blocks_write_admin_or_owner"
  on public.schedule_blocks for all
  using (public.is_admin() or professional_id = auth.uid())
  with check (public.is_admin() or professional_id = auth.uid());

-- ---------------------------------------------------------------------------
-- schedule_change_log — histórico estruturado de alterações na agenda
-- (appointments, schedule_slots, schedule_blocks, schedule_exceptions).
-- Tabela dedicada em vez de reaproveitar audit_logs (0001): audit_logs é
-- admin-only e sem convenção antes/depois; aqui o profissional também
-- precisa ver o que mudou na própria agenda. Uma linha por "evento de
-- edição" (não uma por campo) — essa já é a unidade natural de agrupamento
-- pra notificação (ver notifyAgendaChange, camada de aplicação).
-- ---------------------------------------------------------------------------
create table public.schedule_change_log (
  id uuid primary key default gen_random_uuid(),
  changed_by uuid references public.profiles (id) on delete set null,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  entity_type text not null
    check (entity_type in ('appointment', 'schedule_slot', 'schedule_block', 'schedule_exception')),
  entity_id uuid not null,
  action text not null,
  changes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.schedule_change_log enable row level security;

create index schedule_change_log_professional_idx
  on public.schedule_change_log (professional_id, created_at desc);

-- Sem policy de insert/update/delete pra authenticated: a linha nasce só via
-- service role, dentro da própria Server Action que já fez a alteração
-- (mesmo padrão de appointment_groups, 0067) — evita qualquer chance de um
-- client forjar entrada de histórico.
create policy "schedule_change_log_select"
  on public.schedule_change_log for select
  to authenticated
  using (public.is_admin() or public.current_role() = 'recepcionista' or professional_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Novas permissions
-- ---------------------------------------------------------------------------
insert into public.role_permissions (role, permission) values
  ('profissional', 'appointments.edit.own'),
  ('admin', 'schedule.changes.view'),
  ('recepcionista', 'schedule.changes.view'),
  ('profissional', 'schedule.changes.view.own')
on conflict (role, permission) do nothing;

-- ---------------------------------------------------------------------------
-- prevent_appointment_tampering() — reescrita unificada.
--
-- Hoje (0074) o profissional só consegue: (a) marcar falta no próprio
-- atendimento avulso ou de série, sem mudar mais nada; (b) mudar data/hora de
-- uma ocorrência de série (sem checar se já passou — bug: deixa reagendar
-- série já ocorrida). O pedido confirmado é: profissional edita qualquer
-- atendimento PRÓPRIO (avulso ou série) enquanto for hoje/futuro — paciente,
-- horário, convênio, pagamento, modalidade, valor, status — nunca
-- reatribuindo pra outro profissional; atendimento PASSADO só fecha status
-- (falta/concluída), mais nada.
create or replace function public.prevent_appointment_tampering()
returns trigger
language plpgsql
as $function$
begin
  if public.is_admin() or public.current_role() = 'recepcionista' then
    return new;
  end if;

  if old.professional_id = auth.uid() then
    if new.professional_id <> old.professional_id then
      raise exception 'Você não pode reatribuir o atendimento para outro profissional.';
    end if;

    if old.appointment_date >= current_date then
      return new;
    end if;

    -- Atendimento passado: só fecha o status, nada mais muda.
    if new.status not in ('faltou', 'faltou_justificada', 'concluida') then
      raise exception 'Atendimentos passados só podem ter o status atualizado (falta ou concluída).';
    end if;
    if new.patient_id <> old.patient_id
       or new.value is distinct from old.value
       or new.appointment_date <> old.appointment_date
       or new.start_time <> old.start_time
       or new.insurance_id <> old.insurance_id
       or new.payment_method <> old.payment_method
       or new.modality is distinct from old.modality
       or new.particular_product is distinct from old.particular_product then
      raise exception 'Atendimentos passados só podem ter o status atualizado (falta ou concluída).';
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
     or new.value is distinct from old.value
     or new.appointment_date <> old.appointment_date
     or new.start_time <> old.start_time
     or new.modality is distinct from old.modality
     or new.particular_product is distinct from old.particular_product then
    raise exception 'Alteração não permitida.';
  end if;

  return new;
end;
$function$;
