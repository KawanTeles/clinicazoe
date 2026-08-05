-- Etapa 12: cadastro prévio de pacientes — dados adicionais além de profiles
-- (que já cobre nome, telefone e status). Continua usando profiles + conta
-- Auth como identidade do paciente (mesmo padrão de createPublicAppointment,
-- que já cria usuário com e-mail fictício quando não há login), só que agora
-- a recepção pode fazer esse cadastro antes de qualquer agendamento.

-- Hoje não existe nenhuma policy que deixe a recepcionista ver/editar
-- profiles de pacientes que não sejam dela mesma (só existe para
-- profissional×paciente com histórico, via profiles_select_own_patients_for_professional).
-- Sem isso o módulo de Pacientes fica bloqueado no banco mesmo com a
-- permissão de app liberada.
create policy "profiles_select_patients_staff"
  on public.profiles for select
  to authenticated
  using (role = 'paciente' and (public.is_admin() or public.current_role() = 'recepcionista'));

-- Recepcionista pode editar dados de paciente (nome/telefone), mas o
-- trigger prevent_role_self_escalation (0001_init.sql) continua impedindo
-- qualquer não-admin de alterar role/status na mesma operação.
create policy "profiles_update_patients_staff"
  on public.profiles for update
  to authenticated
  using (role = 'paciente' and (public.is_admin() or public.current_role() = 'recepcionista'))
  with check (role = 'paciente' and (public.is_admin() or public.current_role() = 'recepcionista'));

create table public.patient_details (
  id uuid primary key references public.profiles (id) on delete cascade,
  cpf text,
  birth_date date,
  email text,
  whatsapp text,
  address text,
  city text,
  preferred_insurance_id uuid references public.insurances (id) on delete set null,
  insurance_card_number text,
  insurance_card_valid_until date,
  notes text,
  preferred_professional_id uuid references public.professionals (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.patient_details enable row level security;

create unique index patient_details_cpf_unique
  on public.patient_details (cpf)
  where cpf is not null;

create trigger patient_details_set_updated_at
  before update on public.patient_details
  for each row execute function public.set_updated_at();

-- Staff (admin/recepcionista) vê e edita qualquer paciente. Profissional só
-- vê detalhes de pacientes com quem já teve consulta (mesma condição usada
-- em profiles_select_own_patients_for_professional). Paciente vê o próprio.
create policy "patient_details_select"
  on public.patient_details for select
  to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or public.current_role() = 'recepcionista'
    or exists (
      select 1 from public.appointments
      where appointments.patient_id = patient_details.id
        and appointments.professional_id = auth.uid()
    )
  );

create policy "patient_details_write_staff_only"
  on public.patient_details for all
  using (public.is_admin() or public.current_role() = 'recepcionista')
  with check (public.is_admin() or public.current_role() = 'recepcionista');

insert into public.role_permissions (role, permission) values
  ('admin', 'patients.manage'),
  ('recepcionista', 'patients.manage')
on conflict (role, permission) do nothing;
