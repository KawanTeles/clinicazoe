-- Etapa 38: corrige referência ambígua em patient_evolutions_insert_own
-- (0037_patient_evolutions_multi_professional.sql) — a cláusula de
-- coterapeuta comparava appointment_professionals.appointment_id com ela
-- mesma em vez de com o appointment_id da linha de patient_evolutions
-- sendo inserida, então virava sempre verdadeira para qualquer profissional
-- que seja coterapeuta em QUALQUER consulta do sistema, não só nesta. O
-- trigger patient_evolutions_validate já impedia qualquer insert indevido
-- na prática (não houve exposição de dado), mas a RLS deixava de aplicar
-- essa regra de forma independente.

drop policy "patient_evolutions_insert_own" on public.patient_evolutions;

create policy "patient_evolutions_insert_own"
  on public.patient_evolutions for insert
  to authenticated
  with check (
    professional_id = auth.uid()
    and created_by = auth.uid()
    and (
      exists (
        select 1 from public.appointments
        where appointments.id = patient_evolutions.appointment_id
          and appointments.professional_id = auth.uid()
      )
      or exists (
        select 1 from public.appointment_professionals
        where appointment_professionals.appointment_id = patient_evolutions.appointment_id
          and appointment_professionals.professional_id = auth.uid()
      )
    )
  );
