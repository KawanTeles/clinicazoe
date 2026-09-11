-- Etapa 64: profissional passa a poder marcar falta ("faltou") no próprio
-- atendimento (recepcionista e admin já tinham essa capacidade no banco,
-- só faltava UI/action — feito em booking-actions.ts/AppointmentsList.tsx).
-- Sem isso, prevent_appointment_tampering (0009/0018/0024) barra qualquer
-- UPDATE do profissional em atendimento avulso (não recorrente): a
-- condição "old.professional_id = auth.uid() and old.series_id is not
-- null" só cobre série recorrente, então um atendimento avulso cai no
-- branch do paciente e "Não autorizado." é disparado.
--
-- Adiciona uma exceção nova e restrita, antes dos branches existentes:
-- profissional pode transicionar pendente/confirmada -> faltou no próprio
-- atendimento (avulso ou de série), contanto que nenhum outro campo mude.
create or replace function public.prevent_appointment_tampering()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() or public.current_role() = 'recepcionista' then
    return new;
  end if;

  if old.professional_id = auth.uid()
     and old.status in ('pendente', 'confirmada')
     and new.status = 'faltou' then
    if new.patient_id <> old.patient_id
       or new.professional_id <> old.professional_id
       or new.value <> old.value
       or new.appointment_date <> old.appointment_date
       or new.start_time <> old.start_time
       or new.insurance_id <> old.insurance_id
       or new.payment_method <> old.payment_method
       or new.modality is distinct from old.modality
       or new.particular_product is distinct from old.particular_product then
      raise exception 'Você só pode marcar falta neste atendimento.';
    end if;
    return new;
  end if;

  if old.professional_id = auth.uid() and old.series_id is not null then
    if new.patient_id <> old.patient_id
       or new.professional_id <> old.professional_id
       or new.value <> old.value
       or new.insurance_id <> old.insurance_id
       or new.payment_method <> old.payment_method
       or new.modality is distinct from old.modality
       or new.particular_product is distinct from old.particular_product then
      raise exception 'Você só pode alterar data/horário desta consulta.';
    end if;
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
     or new.start_time <> old.start_time
     or new.modality is distinct from old.modality
     or new.particular_product is distinct from old.particular_product then
    raise exception 'Alteração não permitida.';
  end if;

  return new;
end;
$$;

insert into public.role_permissions (role, permission) values
  ('admin', 'attendance.absences.view'),
  ('recepcionista', 'attendance.absences.view'),
  ('profissional', 'attendance.absences.view')
on conflict (role, permission) do nothing;
