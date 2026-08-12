-- Etapa 50: fecha o Achado M9 da varredura de segurança — duas policies da
-- Etapa 39 (profiles_select_own_patients_for_professional,
-- patient_details_select) reimplementaram a checagem de coterapeuta com um
-- `join public.appointment_professionals ... where ap.professional_id =
-- auth.uid()` direto na policy, em vez de usar
-- public.is_appointment_cotherapist(appointment_id) — a função SECURITY
-- DEFINER criada na Etapa 40 exatamente pra isso, depois que
-- appointments_select x appointment_professionals_select entraram em
-- recursão infinita (42P17) fazendo esse mesmo tipo de join direto.
--
-- As duas policies abaixo não fecham nenhum ciclo hoje (nem appointments
-- nem appointment_professionals fazem join de volta pra profiles/
-- patient_details), então isso não corrige um bug de recursão ativo — é
-- consolidação de padrão: qualquer policy nova que precise saber "este
-- profissional é coterapeuta desta consulta?" usa a função, não reescreve
-- a lógica, então uma mudança futura em appointment_professionals_select
-- não pode reabrir esse risco em silêncio.

drop policy "profiles_select_own_patients_for_professional" on public.profiles;
create policy "profiles_select_own_patients_for_professional"
  on public.profiles for select
  to authenticated
  using (
    role = 'paciente'
    and (
      exists (
        select 1 from public.appointments
        where appointments.patient_id = profiles.id
          and appointments.professional_id = auth.uid()
      )
      or exists (
        select 1 from public.appointments a
        where a.patient_id = profiles.id
          and public.is_appointment_cotherapist(a.id)
      )
    )
  );

drop policy "patient_details_select" on public.patient_details;
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
    or exists (
      select 1 from public.appointments a
      where a.patient_id = patient_details.id
        and public.is_appointment_cotherapist(a.id)
    )
  );
