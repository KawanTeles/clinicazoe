-- Etapa 46: Transcrição de áudio (Whisper/OpenAI) na tela de registrar
-- evolução — o profissional envia o áudio da sessão, o texto transcrito
-- alimenta o mesmo fluxo de improveEvolutionText já existente. O áudio em
-- si nunca é persistido: é enviado à OpenAI, e o objeto no Storage é
-- apagado assim que a transcrição é concluída com sucesso — só o texto
-- resultante fica salvo em session_transcriptions. Por isso a tabela nem
-- guarda um path de arquivo: não há nada de duradouro para apontar.
--
-- Chave de API dedicada (transcription_api_key_ciphertext), independente
-- do provedor de texto principal já configurado em ai_settings — mesma
-- decisão de produto de manter o crédito/custo de transcrição isolado do
-- crédito do provedor de texto (que pode nem ser a OpenAI).
--
-- session_transcriptions segue exatamente o mesmo modelo de acesso de
-- patient_evolutions (Etapa 25/31/37): sigilo profissional (só quem
-- transcreveu vê, admin não tem policy de select), e o mesmo suporte a
-- atendimento compartilhado (Etapa 36/37) — tanto o profissional principal
-- da consulta quanto um coterapeuta vinculado podem transcrever, cada um
-- só enxerga a própria transcrição. Sem policy de update (transcrição é o
-- resultado bruto da API, nunca editado in place — quem usa o texto edita
-- o campo de evolução, não isto aqui) nem de delete (mesmo princípio de
-- histórico permanente do resto do prontuário).

-- ---------------------------------------------------------------------------
-- ai_settings: chave de API dedicada + toggle, independentes do provedor de
-- texto principal (provider/model/api_key_ciphertext já existentes).
-- ---------------------------------------------------------------------------

alter table public.ai_settings
  add column transcription_enabled boolean not null default false,
  add column transcription_api_key_ciphertext text,
  add column transcription_api_key_last4 text;

-- ---------------------------------------------------------------------------
-- session_transcriptions
-- ---------------------------------------------------------------------------

create table public.session_transcriptions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  transcribed_text text not null,
  -- created_by é NOT NULL: "on delete restrict", não "set null" — mesma
  -- lição da Etapa 42/45 (created_by_fkey com FK "set null" trava o delete
  -- do profile com "violates not-null constraint").
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.session_transcriptions enable row level security;

create index session_transcriptions_appointment_idx
  on public.session_transcriptions (appointment_id, created_at desc);
create index session_transcriptions_professional_idx
  on public.session_transcriptions (professional_id, created_at desc);

-- Mesma validação de patient_evolutions_validate (Etapa 25/37): profissional
-- precisa ser o principal da consulta OU um coterapeuta vinculado
-- (appointment_professionals), o paciente precisa bater com o da consulta,
-- e a consulta precisa já ter acontecido.
create or replace function public.session_transcriptions_validate()
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
    raise exception 'A transcrição deve pertencer ao paciente da consulta.';
  end if;

  is_linked_professional := new.professional_id = appt.professional_id
    or exists (
      select 1 from public.appointment_professionals ap
      where ap.appointment_id = new.appointment_id
        and ap.professional_id = new.professional_id
    );

  if not is_linked_professional then
    raise exception 'A transcrição deve pertencer a um profissional vinculado à consulta.';
  end if;

  if appt.status not in ('confirmada', 'concluida') then
    raise exception 'Só é possível transcrever áudio de consultas realizadas.';
  end if;

  return new;
end;
$$;

create trigger session_transcriptions_validate_bi
  before insert on public.session_transcriptions
  for each row execute function public.session_transcriptions_validate();

-- Sigilo profissional (mesmo espírito da Etapa 31): só quem transcreveu vê;
-- admin não tem policy de select, não enxerga o texto transcrito.
create policy "session_transcriptions_select_own"
  on public.session_transcriptions for select
  to authenticated
  using (professional_id = auth.uid());

-- Principal OU coterapeuta vinculado à consulta (mesmo padrão da Etapa 37
-- para patient_evolutions_insert_own, já corrigido pela Etapa 38 para
-- qualificar appointment_id pelo nome da tabela e evitar referência
-- ambígua).
create policy "session_transcriptions_insert_own"
  on public.session_transcriptions for insert
  to authenticated
  with check (
    professional_id = auth.uid()
    and created_by = auth.uid()
    and (
      exists (
        select 1 from public.appointments
        where appointments.id = session_transcriptions.appointment_id
          and appointments.professional_id = auth.uid()
      )
      or exists (
        select 1 from public.appointment_professionals
        where appointment_professionals.appointment_id = session_transcriptions.appointment_id
          and appointment_professionals.professional_id = auth.uid()
      )
    )
  );

-- Sem policy de update: o texto transcrito é imutável (resultado bruto da
-- API). Sem policy de delete: mesmo princípio de histórico permanente já
-- aplicado a patient_evolutions/ai_reports — nem admin, nem o próprio
-- profissional podem excluir.

-- Reaproveita a permissão já existente 'profissional' / 'ai.evolution_assistant.use'
-- (Etapa 28) — o botão "Transcrever áudio" vive na mesma tela/fluxo do
-- assistente de escrita, não é um recurso novo a habilitar separadamente
-- por cargo. transcription_enabled (ai_settings, acima) é o toggle que liga
-- ou desliga a transcrição em si, independente da permissão de cargo.
