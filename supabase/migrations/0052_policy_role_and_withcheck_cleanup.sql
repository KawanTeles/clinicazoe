-- Nitpicks cosméticos de RLS (sem mudança de comportamento):
-- 1) Adiciona "TO authenticated" explícito em policies antigas que hoje
--    valem para {public} (papel implícito quando a policy é criada sem
--    "TO"). O USING/WITH CHECK de cada uma já exige auth.uid()/is_admin()/
--    public.current_role(), que retornam null/false para anon — então anon já
--    era bloqueado na prática; isso só remove a ambiguidade.
-- 2) Adiciona WITH CHECK explícito nas policies de UPDATE que hoje dependem
--    do comportamento implícito do Postgres (reusar USING como WITH CHECK
--    quando WITH CHECK é omitido em policy de UPDATE) — mesmo efeito,
--    mais legível.

alter policy "ai_settings_admin_only" on public.ai_settings to authenticated;
alter policy "appointment_series_write_staff_only" on public.appointment_series to authenticated;
alter policy "audit_logs_select_admin_only" on public.audit_logs to authenticated;
alter policy "clinic_holidays_write_admin_only" on public.clinic_holidays to authenticated;
alter policy "clinic_settings_write_admin_only" on public.clinic_settings to authenticated;
alter policy "insurances_write_admin_only" on public.insurances to authenticated;
alter policy "patient_details_write_staff_only" on public.patient_details to authenticated;
alter policy "professional_insurances_write_admin_only" on public.professional_insurances to authenticated;
alter policy "professionals_delete_admin_only" on public.professionals to authenticated;
alter policy "professionals_insert_admin_only" on public.professionals to authenticated;
alter policy "professionals_select_self_or_admin" on public.professionals to authenticated;
alter policy "professionals_update_self_or_admin" on public.professionals to authenticated;
alter policy "profiles_delete_admin_only" on public.profiles to authenticated;
alter policy "profiles_select_self_or_admin" on public.profiles to authenticated;
alter policy "profiles_update_self_or_admin" on public.profiles to authenticated;
alter policy "role_permissions_write_admin_only" on public.role_permissions to authenticated;
alter policy "schedule_exceptions_write_admin_or_owner" on public.schedule_exceptions to authenticated;
alter policy "schedule_slot_insurances_write_admin_or_owner" on public.schedule_slot_insurances to authenticated;
alter policy "schedule_slots_write_admin_or_owner" on public.schedule_slots to authenticated;
alter policy "specialties_write_admin_only" on public.specialties to authenticated;

alter policy "appointments_update" on public.appointments
  with check ((patient_id = auth.uid()) or public.is_admin() or (public.current_role() = 'recepcionista'::text));

alter policy "appointments_update_professional_own" on public.appointments
  with check (professional_id = auth.uid());

alter policy "financial_entries_update" on public.financial_entries
  with check ((professional_id = auth.uid()) or public.is_admin());

alter policy "financial_entries_update_recepcionista" on public.financial_entries
  with check (public.current_role() = 'recepcionista'::text);

alter policy "waitlist_entries_update_staff" on public.waitlist_entries
  with check (public.is_admin() or (public.current_role() = 'recepcionista'::text));
