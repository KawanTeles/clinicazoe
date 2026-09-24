-- Um profissional passa a poder ter várias especialidades (antes: 1 só via
-- professionals.specialty_id). Tabela de junção N:N, no mesmo padrão de
-- professional_insurances (0006). professionals.specialty_id é mantido e
-- passa a guardar a especialidade "principal" (a 1ª escolhida no cadastro),
-- para não quebrar os demais pontos do sistema que ainda dependem de uma
-- única especialidade por profissional (agendamento manual da recepção,
-- evoluções, lista de espera, solicitações).

create table public.professional_specialties (
  professional_id uuid not null references public.professionals (id) on delete cascade,
  specialty_id uuid not null references public.specialties (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (professional_id, specialty_id)
);

alter table public.professional_specialties enable row level security;

create policy "professional_specialties_select"
  on public.professional_specialties for select
  to authenticated
  using (true);

create policy "professional_specialties_write_admin_only"
  on public.professional_specialties for all
  using (public.is_admin())
  with check (public.is_admin());

insert into public.professional_specialties (professional_id, specialty_id)
select id, specialty_id from public.professionals
where specialty_id is not null
on conflict do nothing;
