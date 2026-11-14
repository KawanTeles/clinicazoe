-- Etapa 81: Acompanhamento de evoluções pela Coordenação (Parte 3 do pedido
-- original) — "ela quer saber apenas se as evoluções estão sendo feitas e
-- quantas foram" (confirmado pelo usuário).
--
-- A tela NÃO lê patient_evolutions nem evolution_drafts diretamente — a
-- Coordenação não tem (e não ganha aqui) nenhuma policy de SELECT nessas duas
-- tabelas, exatamente como admin e recepção desde a 0031/0069. Em vez disso,
-- uma única função SECURITY DEFINER calcula o status (concluída / em
-- rascunho / pendente) e devolve só identificadores, datas e situação — nunca
-- uma coluna de texto. Mesmo que a tela mude amanhã, não há como o conteúdo
-- clínico vazar por aqui: a função não expõe a coluna, o problema não é de
-- interface.
--
-- Pendente = atendimento já realizado (confirmada/concluída, data+hora no
-- passado) sem evolução nem rascunho. Esta clínica nunca usa o status
-- 'concluida' na prática (confirmado por amostragem: zero linhas em todo o
-- histórico) — por isso o critério é por DATA/HORA, não pelo valor do status.

-- ---------------------------------------------------------------------------
-- 1) Prazo de atraso, configurável pela própria Coordenação — tabela
--    dedicada, não uma coluna em clinic_settings. clinic_settings é
--    admin-only (0001) e dar à Coordenação escrita nela abriria endereço,
--    telefone, preço, logo — tudo, para liberar um único número.
-- ---------------------------------------------------------------------------
create table public.evolution_tracking_settings (
  id smallint primary key default 1 check (id = 1),
  late_after_hours integer not null default 48 check (late_after_hours > 0),
  updated_at timestamptz not null default now()
);

alter table public.evolution_tracking_settings enable row level security;

create trigger evolution_tracking_settings_set_updated_at
  before update on public.evolution_tracking_settings
  for each row execute function public.set_updated_at();

create policy "evolution_tracking_settings_select"
  on public.evolution_tracking_settings for select
  to authenticated
  using (public.is_admin() or public.is_coordinator());

create policy "evolution_tracking_settings_write"
  on public.evolution_tracking_settings for update
  to authenticated
  using (public.is_admin() or public.is_coordinator())
  with check (public.is_admin() or public.is_coordinator());

insert into public.evolution_tracking_settings (id) values (1);

-- ---------------------------------------------------------------------------
-- 2) A função. Mesmo padrão de is_appointment_cotherapist()/book_appointment:
--    SECURITY DEFINER para cruzar RLS de propósito, com checagem de
--    autorização NO CORPO da função (não depende de quem a chamou ter
--    SELECT nas tabelas por trás) — sem o `if not (...) raise exception`
--    abaixo, qualquer authenticated que descobrisse o nome da função
--    chamaria via supabase.rpc() e leria status de evolução de todo mundo.
-- ---------------------------------------------------------------------------
create or replace function public.get_evolution_tracking(
  p_date_from date default null,
  p_date_to date default null,
  p_professional_id uuid default null,
  p_specialty_id uuid default null
)
returns table (
  appointment_id uuid,
  professional_id uuid,
  professional_name text,
  patient_id uuid,
  patient_name text,
  specialty_id uuid,
  specialty_name text,
  appointment_date date,
  start_time time,
  end_time time,
  status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or public.is_coordinator()) then
    raise exception 'Acesso negado.';
  end if;

  return query
  with candidatos as (
    -- Profissional principal do atendimento.
    select a.id as appointment_id, a.professional_id, a.patient_id, a.specialty_id,
           a.appointment_date, a.start_time, a.end_time
      from public.appointments a
     where a.status in ('confirmada', 'concluida')
       and (p_date_from is null or a.appointment_date >= p_date_from)
       and (p_date_to is null or a.appointment_date <= p_date_to)
       and (p_professional_id is null or a.professional_id = p_professional_id)
       and (p_specialty_id is null or a.specialty_id = p_specialty_id)
    union
    -- Coterapeuta (atendimento conjugado) — mesma consulta, profissional
    -- extra. Falta do coterapeuta fica de fora: appointment_professionals
    -- .absence_status não nulo significa que ele não participou, então não
    -- deve evolução (mesmo espírito do item 13 do pedido original).
    select a.id, ap.professional_id, a.patient_id, a.specialty_id,
           a.appointment_date, a.start_time, a.end_time
      from public.appointment_professionals ap
      join public.appointments a on a.id = ap.appointment_id
     where a.status in ('confirmada', 'concluida')
       and ap.absence_status is null
       and (p_date_from is null or a.appointment_date >= p_date_from)
       and (p_date_to is null or a.appointment_date <= p_date_to)
       and (p_professional_id is null or ap.professional_id = p_professional_id)
       and (p_specialty_id is null or a.specialty_id = p_specialty_id)
  )
  select
    c.appointment_id,
    c.professional_id,
    prof.full_name,
    c.patient_id,
    pat.full_name,
    c.specialty_id,
    sp.name,
    c.appointment_date,
    c.start_time,
    c.end_time,
    case
      when pe.id is not null then 'concluida'
      when ed.id is not null then 'em_rascunho'
      else 'pendente'
    end
    from candidatos c
    join public.profiles prof on prof.id = c.professional_id
    join public.profiles pat on pat.id = c.patient_id
    left join public.specialties sp on sp.id = c.specialty_id
    left join public.patient_evolutions pe
      on pe.appointment_id = c.appointment_id and pe.professional_id = c.professional_id
    left join public.evolution_drafts ed
      on ed.appointment_id = c.appointment_id and ed.professional_id = c.professional_id
   -- Só entra atendimento que já ACONTECEU (sem isso, agendamento confirmado
   -- de amanhã apareceria como "pendente" hoje).
   where c.appointment_date < current_date
      or (c.appointment_date = current_date and c.end_time <= current_time);
end;
$$;

comment on function public.get_evolution_tracking is
  'Status de evolução (concluida/em_rascunho/pendente) por atendimento realizado, SEM nenhuma coluna de conteúdo clínico. Autorização verificada DENTRO da função (admin ou is_coordinator()) — chamar via supabase.rpc() nunca depende de RLS de patient_evolutions/evolution_drafts, que a Coordenação não tem.';
