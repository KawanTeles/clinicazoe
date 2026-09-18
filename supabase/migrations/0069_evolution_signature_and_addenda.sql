-- Etapa 69: assinatura eletrônica em patient_evolutions + complementação
-- (adendo) + leitura por vínculo com o paciente.
--
-- Motivação: uma profissional pode sair da clínica e outra assumir os
-- mesmos pacientes. As evoluções antigas precisam continuar existindo,
-- visíveis para quem assume o paciente, e com autoria/data que ninguém
-- consegue editar depois — mesmo depois que a profissional original for
-- desativada (soft delete, já suportado por profiles.status/professionals.
-- status desde a Etapa 1; patient_evolutions.professional_id já é
-- ON DELETE RESTRICT desde a Etapa 48, então um hard delete com evolução
-- vinculada já falha hoje, não apaga em cascata).
--
-- Três mudanças:
--   1) Assinatura imutável: nome do profissional em snapshot (coluna nova,
--      preenchida pelo trigger a partir de profiles.full_name no momento do
--      INSERT — nunca aceita valor do client). created_at já existia e já
--      não é reescrito.
--   2) Evolução vira 100% imutável depois de salva: remove a policy de
--      UPDATE (só o autor podia editar livremente até aqui). Correção
--      depois de assinada passa a ser SEMPRE uma complementação/adendo
--      (tabela nova patient_evolution_addenda) — novo registro, nunca
--      sobrescreve o original. Sem policy de UPDATE/DELETE para adendo
--      também: mesma imutabilidade.
--   3) Leitura deixa de ser "só quem escreveu aquela linha"
--      (patient_evolutions_select_own, Etapa 31) e passa a ser "profissional
--      vinculado ao paciente" (qualquer appointment como principal ou
--      coterapeuta, mesmo critério já usado por patient_details_select,
--      Etapa 50/is_appointment_cotherapist) — assim um profissional novo
--      que assume o paciente enxerga o histórico INTEIRO, de todos que já
--      o atenderam, não só o que ele mesmo escreveu. Admin/recepção
--      continuam SEM acesso ao conteúdo clínico (decisão de sigilo
--      profissional/LGPD da Etapa 31, mantida de propósito).

-- 1) Assinatura: nome do profissional em snapshot.
alter table public.patient_evolutions
  add column professional_name_snapshot text;

-- Backfill dispara os triggers BEFORE UPDATE existentes (validate/
-- set_editor/snapshot_version) se não forem desligados antes — o de
-- validação reavalia até status de consulta e rejeitaria linhas antigas
-- sem motivo, e o de "quem editou" sujaria updated_by/updated_at de TODA
-- evolução só por causa deste backfill. Desliga os três, faz o UPDATE
-- (que só toca a coluna nova, nenhum dado clínico), religa em seguida.
alter table public.patient_evolutions disable trigger patient_evolutions_validate_biu;
alter table public.patient_evolutions disable trigger patient_evolutions_set_editor;
alter table public.patient_evolutions disable trigger patient_evolutions_snapshot_version_bu;

update public.patient_evolutions pe
  set professional_name_snapshot = p.full_name
  from public.profiles p
  where p.id = pe.professional_id
    and pe.professional_name_snapshot is null;

alter table public.patient_evolutions enable trigger patient_evolutions_validate_biu;
alter table public.patient_evolutions enable trigger patient_evolutions_set_editor;
alter table public.patient_evolutions enable trigger patient_evolutions_snapshot_version_bu;

alter table public.patient_evolutions
  alter column professional_name_snapshot set not null;

-- Preenche o snapshot no INSERT (create or replace não exige recriar a
-- trigger patient_evolutions_validate_biu, 0025 — ela já aponta pra esta
-- função). Corpo igual ao da Etapa 37, só com o preenchimento do snapshot
-- adicionado no ramo INSERT.
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

  if tg_op = 'INSERT' then
    select full_name into new.professional_name_snapshot
      from public.profiles
      where id = new.professional_id;
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

-- 2) Trava edição: sem policy de UPDATE para nenhum papel a partir de
-- agora — nem o próprio autor. Único jeito de corrigir/complementar depois
-- de assinada é um adendo (abaixo). O ramo "UPDATE" da função acima e os
-- triggers de versionamento (Etapa 41, patient_evolutions_set_editor/
-- patient_evolutions_snapshot_version_bu) ficam como defesa em profundidade
-- — só alcançáveis via service role, fora do fluxo normal da aplicação,
-- mesmo padrão já usado para DELETE desde a Etapa 25.
drop policy "patient_evolutions_update_own" on public.patient_evolutions;

-- 3) Leitura por vínculo com o paciente, não mais só autoria.
drop policy "patient_evolutions_select_own" on public.patient_evolutions;

create policy "patient_evolutions_select_linked_patient"
  on public.patient_evolutions for select
  to authenticated
  using (
    exists (
      select 1 from public.appointments
      where appointments.patient_id = patient_evolutions.patient_id
        and appointments.professional_id = auth.uid()
    )
    or exists (
      select 1 from public.appointments a
      where a.patient_id = patient_evolutions.patient_id
        and public.is_appointment_cotherapist(a.id)
    )
  );

-- Complementação/adendo: novo registro vinculado à evolução original,
-- nunca sobrescreve o que já foi assinado. Mesma assinatura imutável
-- (nome em snapshot + created_at) e mesmo critério de leitura por vínculo
-- ao paciente da evolução original. Sem policy de UPDATE/DELETE: imutável
-- desde a criação.
create table public.patient_evolution_addenda (
  id uuid primary key default gen_random_uuid(),
  evolution_id uuid not null references public.patient_evolutions (id) on delete restrict,
  -- Denormalizado de patient_evolutions só para a RLS não precisar de join
  -- (mesmo motivo de patient_evolution_versions.professional_id, Etapa 41).
  patient_id uuid not null references public.profiles (id) on delete restrict,
  professional_id uuid not null references public.professionals (id) on delete restrict,
  professional_name_snapshot text not null,
  content text not null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.patient_evolution_addenda enable row level security;

create index patient_evolution_addenda_evolution_idx
  on public.patient_evolution_addenda (evolution_id, created_at);

create or replace function public.patient_evolution_addenda_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
begin
  select patient_id into ev
    from public.patient_evolutions
    where id = new.evolution_id;

  if ev is null then
    raise exception 'Evolução original não encontrada.';
  end if;

  if new.patient_id <> ev.patient_id then
    raise exception 'O adendo deve pertencer ao mesmo paciente da evolução original.';
  end if;

  select full_name into new.professional_name_snapshot
    from public.profiles
    where id = new.professional_id;

  return new;
end;
$$;

create trigger patient_evolution_addenda_validate_bi
  before insert on public.patient_evolution_addenda
  for each row execute function public.patient_evolution_addenda_validate();

create policy "patient_evolution_addenda_select_linked_patient"
  on public.patient_evolution_addenda for select
  to authenticated
  using (
    exists (
      select 1 from public.appointments
      where appointments.patient_id = patient_evolution_addenda.patient_id
        and appointments.professional_id = auth.uid()
    )
    or exists (
      select 1 from public.appointments a
      where a.patient_id = patient_evolution_addenda.patient_id
        and public.is_appointment_cotherapist(a.id)
    )
  );

create policy "patient_evolution_addenda_insert_linked_patient"
  on public.patient_evolution_addenda for insert
  to authenticated
  with check (
    professional_id = auth.uid()
    and created_by = auth.uid()
    and (
      exists (
        select 1 from public.appointments
        where appointments.patient_id = patient_evolution_addenda.patient_id
          and appointments.professional_id = auth.uid()
      )
      or exists (
        select 1 from public.appointments a
        where a.patient_id = patient_evolution_addenda.patient_id
          and public.is_appointment_cotherapist(a.id)
      )
    )
  );

-- Sem policy de UPDATE/DELETE para nenhum papel: adendo é imutável desde a
-- criação, mesmo princípio de patient_evolutions.
