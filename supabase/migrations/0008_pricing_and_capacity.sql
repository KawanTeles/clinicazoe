-- Etapa 3/5: precificação por profissional (particular por forma de
-- pagamento + valor por convênio), duração de consulta e vagas por horário.

alter table public.professionals
  add column consultation_duration_minutes int not null default 30
    check (consultation_duration_minutes > 0),
  add column price_particular_card numeric(10, 2) check (price_particular_card >= 0),
  add column price_particular_pix numeric(10, 2) check (price_particular_pix >= 0),
  add column price_particular_cash numeric(10, 2) check (price_particular_cash >= 0);

alter table public.professional_insurances
  add column value numeric(10, 2) not null default 0 check (value >= 0);

alter table public.schedule_slots
  add column capacity int not null default 1 check (capacity > 0);
