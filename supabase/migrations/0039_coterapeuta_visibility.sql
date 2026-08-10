-- Etapa 39: amplia RLS para reconhecer coterapeutas, não só o principal
-- (appointment_professionals, 0036) — appointments_select,
-- profiles_select_own_patients_for_professional e patient_details_select
-- ainda só checavam appointments.professional_id.

drop policy "appointments_select" on public.appointments;
create policy "appointments_select"
  on public.appointments for select
  to authenticated
  using (
    patient_id = auth.uid()
    or professional_id = auth.uid()
    or public.is_admin()
    or public.current_role() = 'recepcionista'
    or exists (
      select 1 from public.appointment_professionals ap
      where ap.appointment_id = appointments.id and ap.professional_id = auth.uid()
    )
  );

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
        join public.appointment_professionals ap on ap.appointment_id = a.id
        where a.patient_id = profiles.id and ap.professional_id = auth.uid()
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
      join public.appointment_professionals ap on ap.appointment_id = a.id
      where a.patient_id = patient_details.id and ap.professional_id = auth.uid()
    )
  );
