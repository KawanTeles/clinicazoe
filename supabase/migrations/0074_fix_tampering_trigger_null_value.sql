-- 0073 tornou appointments.value opcional (null = "pendente"). O trigger
-- prevent_appointment_tampering comparava a coluna value com `<>` em três
-- pontos — operador que no Postgres sempre resulta em NULL (nunca TRUE)
-- quando um dos lados é NULL, e `if null then` em plpgsql é tratado como
-- falso. Resultado: para um atendimento com value pendente, a condição que
-- deveria bloquear um profissional de alterar o valor junto de uma marcação
-- de falta/remarcação silenciosamente deixava de disparar. modality e
-- particular_product já usavam `is distinct from` (null-safe) por já serem
-- colunas nullable antes de value — aplicamos a mesma correção aqui.
create or replace function public.prevent_appointment_tampering()
returns trigger
language plpgsql
as $function$
begin
  if public.is_admin() or public.current_role() = 'recepcionista' then
    return new;
  end if;

  if old.professional_id = auth.uid()
     and old.status in ('pendente', 'confirmada')
     and new.status in ('faltou', 'faltou_justificada') then
    if new.patient_id <> old.patient_id
       or new.professional_id <> old.professional_id
       or new.value is distinct from old.value
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
       or new.value is distinct from old.value
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
     or new.value is distinct from old.value
     or new.appointment_date <> old.appointment_date
     or new.start_time <> old.start_time
     or new.modality is distinct from old.modality
     or new.particular_product is distinct from old.particular_product then
    raise exception 'Alteração não permitida.';
  end if;

  return new;
end;
$function$;
