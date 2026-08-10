-- Etapa 40: corrige recursão infinita de RLS introduzida na 0039.
--
-- appointments_select passou a checar `exists (... from
-- appointment_professionals ...)`. Só que appointment_professionals_select
-- (0036) já checa `exists (... from appointments ...)` de volta — as duas
-- policies passaram a se referenciar mutuamente via subquery direta, o que
-- o Postgres detecta como recursão infinita (42P17) e recusa executar.
--
-- Correção: o teste "este profissional é coterapeuta desta consulta?"
-- passa a rodar dentro de uma função SECURITY DEFINER (mesmo padrão já
-- usado por is_admin()/current_role()), que roda com os privilégios do
-- dono da função e portanto NÃO reaplica a RLS de appointment_professionals
-- ao consultá-la — quebra o ciclo sem abrir mão da regra de negócio.

create or replace function public.is_appointment_cotherapist(p_appointment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.appointment_professionals
    where appointment_id = p_appointment_id
      and professional_id = auth.uid()
  );
$$;

drop policy "appointments_select" on public.appointments;
create policy "appointments_select"
  on public.appointments for select
  to authenticated
  using (
    patient_id = auth.uid()
    or professional_id = auth.uid()
    or public.is_admin()
    or public.current_role() = 'recepcionista'
    or public.is_appointment_cotherapist(id)
  );
