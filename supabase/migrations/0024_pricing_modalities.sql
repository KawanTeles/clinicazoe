-- Etapa 24: Unimed e Postal Saúde passam a ter 2 modalidades (ABA/Comum) com
-- valor por profissional; Particular deixa de ser por profissional/forma de
-- pagamento e passa a ter 2 valores únicos para a clínica inteira (Consulta
-- Particular / Pacote Particular), configurados em Configurações da Clínica.
--
-- professionals, professional_insurances, appointments, appointment_series e
-- financial_entries estão todas vazias neste ambiente: sem necessidade de
-- backfill/default para as colunas novas.

-- 1) professional_insurances: 1 linha por profissional + convênio + modalidade
alter table public.professional_insurances
  add column modality text not null check (modality in ('aba', 'comum'));

alter table public.professional_insurances
  drop constraint professional_insurances_pkey;

alter table public.professional_insurances
  add constraint professional_insurances_pkey
  primary key (professional_id, insurance_id, modality);

-- 2) professionals: Particular não é mais precificado por profissional
alter table public.professionals
  drop column price_particular_card,
  drop column price_particular_pix,
  drop column price_particular_cash;

-- 3) clinic_settings: 2 valores globais de Particular
alter table public.clinic_settings
  add column price_particular_consultation numeric(10, 2)
    check (price_particular_consultation >= 0),
  add column price_particular_package numeric(10, 2)
    check (price_particular_package >= 0);

-- 4) appointments / appointment_series / financial_entries: modalidade
-- (convênio) OU produto (particular) — nunca os dois ao mesmo tempo.
-- financial_entries e appointment_series já espelham insurance_id/value/
-- payment_method de appointments (ver 0010/0018) — mantém o mesmo espelhamento.
alter table public.appointments
  add column modality text check (modality in ('aba', 'comum')),
  add column particular_product text check (particular_product in ('consulta', 'pacote')),
  add constraint appointments_modality_xor_product
    check (not (modality is not null and particular_product is not null));

alter table public.appointment_series
  add column modality text check (modality in ('aba', 'comum')),
  add column particular_product text check (particular_product in ('consulta', 'pacote')),
  add constraint appointment_series_modality_xor_product
    check (not (modality is not null and particular_product is not null));

alter table public.financial_entries
  add column modality text check (modality in ('aba', 'comum')),
  add column particular_product text check (particular_product in ('consulta', 'pacote')),
  add constraint financial_entries_modality_xor_product
    check (not (modality is not null and particular_product is not null));

-- 5) Estende os triggers de tampering (0009/0013/0018/0022) para proteger as
-- colunas novas com a mesma lógica que já protege value/insurance_id/
-- payment_method.
create or replace function public.prevent_appointment_tampering()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() or public.current_role() = 'recepcionista' then
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

create or replace function public.prevent_series_tampering()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() or public.current_role() = 'recepcionista' then
    return new;
  end if;

  if old.professional_id <> auth.uid() then
    raise exception 'Não autorizado.';
  end if;

  if new.patient_id <> old.patient_id
     or new.professional_id <> old.professional_id
     or new.insurance_id <> old.insurance_id
     or new.payment_method <> old.payment_method
     or new.specialty_id is distinct from old.specialty_id
     or new.modality is distinct from old.modality
     or new.particular_product is distinct from old.particular_product then
    raise exception 'Você só pode alterar dia, horário, duração ou status desta recorrência.';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_financial_entry_tampering()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if public.current_role() <> 'recepcionista' and old.professional_id <> auth.uid() then
    raise exception 'Não autorizado.';
  end if;

  if new.value <> old.value
     or new.due_date <> old.due_date
     or new.patient_id <> old.patient_id
     or new.professional_id <> old.professional_id
     or new.insurance_id is distinct from old.insurance_id
     or new.payment_method <> old.payment_method
     or new.modality is distinct from old.modality
     or new.particular_product is distinct from old.particular_product then
    raise exception 'Alteração não permitida.';
  end if;

  return new;
end;
$$;
