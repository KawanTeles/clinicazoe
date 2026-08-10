-- Etapa 36: appointment_professionals — profissionais ADICIONAIS
-- (coterapeutas) vinculados a uma consulta. appointments.professional_id
-- continua sendo o profissional principal/dono da agenda consumida; esta
-- tabela nunca duplica esse valor, só guarda os profissionais extras.
--
-- Regras de acesso (reforçadas por RLS):
--   admin / recepcionista       -> podem ver, adicionar e remover em
--                                  qualquer consulta.
--   profissional principal      -> pode ver, adicionar e remover
--                                  coterapeutas só nas próprias consultas
--                                  (appointments.professional_id = auth.uid()).
--   coterapeuta                 -> só visualiza o próprio vínculo; não
--                                  adiciona nem remove ninguém (decisão
--                                  confirmada: só principal ou staff editam
--                                  a consulta).
--   paciente                    -> visualiza os profissionais vinculados
--                                  às próprias consultas.
--   ninguém                     -> não é possível remover um coterapeuta
--                                  que já registrou evolução para essa
--                                  consulta (histórico clínico preservado).

create table public.appointment_professionals (
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  primary key (appointment_id, professional_id)
);

create index appointment_professionals_professional_idx
  on public.appointment_professionals (professional_id);

alter table public.appointment_professionals enable row level security;

-- Impede vincular como "coterapeuta" o mesmo profissional que já é o
-- principal da consulta (evita duplicidade/ambiguidade).
create or replace function public.appointment_professionals_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_primary_professional uuid;
begin
  select professional_id
    into v_primary_professional
    from public.appointments
    where id = new.appointment_id;

  if v_primary_professional is null then
    raise exception 'Consulta não encontrada.';
  end if;

  if v_primary_professional = new.professional_id then
    raise exception 'Este profissional já é o principal desta consulta.';
  end if;

  return new;
end;
$$;

create trigger appointment_professionals_validate_bi
  before insert on public.appointment_professionals
  for each row execute function public.appointment_professionals_validate();

-- Bloqueia a remoção de um coterapeuta que já registrou evolução para essa
-- consulta — mesmo espírito de "nunca apagar evolução clínica" já aplicado
-- em patient_evolutions (que também não tem policy de delete). Roda mesmo
-- para admin, já que a trigger não olha para quem está executando o DELETE.
create or replace function public.appointment_professionals_prevent_delete_with_evolution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.patient_evolutions
    where appointment_id = old.appointment_id
      and professional_id = old.professional_id
  ) then
    raise exception 'Não é possível remover este profissional: ele já registrou evolução para esta consulta.';
  end if;

  return old;
end;
$$;

create trigger appointment_professionals_prevent_delete_bd
  before delete on public.appointment_professionals
  for each row execute function public.appointment_professionals_prevent_delete_with_evolution();

-- SELECT: quem já pode ver a consulta em appointments_select (paciente
-- dono, profissional principal, admin, recepcionista) também vê os
-- vínculos de coterapeutas; o próprio coterapeuta vê a si mesmo mesmo sem
-- ser o principal.
create policy "appointment_professionals_select"
  on public.appointment_professionals for select
  to authenticated
  using (
    professional_id = auth.uid()
    or public.is_admin()
    or public.current_role() = 'recepcionista'
    or exists (
      select 1 from public.appointments a
      where a.id = appointment_id
        and (a.patient_id = auth.uid() or a.professional_id = auth.uid())
    )
  );

-- INSERT: admin, recepcionista, ou o profissional principal da própria
-- consulta (decisão confirmada). Nunca o coterapeuta, nunca o paciente.
create policy "appointment_professionals_insert"
  on public.appointment_professionals for insert
  to authenticated
  with check (
    public.is_admin()
    or public.current_role() = 'recepcionista'
    or exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.professional_id = auth.uid()
    )
  );

-- DELETE: mesmos atores do insert. A trigger acima bloqueia a remoção se
-- já existir evolução do coterapeuta para essa consulta, independente de
-- quem está tentando remover.
create policy "appointment_professionals_delete"
  on public.appointment_professionals for delete
  to authenticated
  using (
    public.is_admin()
    or public.current_role() = 'recepcionista'
    or exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.professional_id = auth.uid()
    )
  );

-- Sem policy de UPDATE: o vínculo é imutável (existe ou não existe); para
-- "trocar" um coterapeuta, remove-se um e adiciona-se outro.
