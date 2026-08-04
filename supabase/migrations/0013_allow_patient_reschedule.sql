-- Etapa 8: paciente também pode marcar a própria consulta como "remarcada"
-- (fluxo de remarcar = cancela a atual com esse status e reabre o wizard).

create or replace function public.prevent_appointment_tampering()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() or public.current_role() = 'recepcionista' then
    return new;
  end if;

  if old.patient_id <> auth.uid() then
    raise exception 'Não autorizado.';
  end if;

  if new.status not in ('cancelada', 'remarcada') then
    raise exception 'Você só pode cancelar ou remarcar sua própria consulta.';
  end if;

  if new.patient_id <> old.patient_id
     or new.professional_id <> old.professional_id
     or new.value <> old.value
     or new.appointment_date <> old.appointment_date
     or new.start_time <> old.start_time then
    raise exception 'Alteração não permitida.';
  end if;

  return new;
end;
$$;
