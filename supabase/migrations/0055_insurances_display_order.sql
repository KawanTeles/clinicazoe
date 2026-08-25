-- Permite reordenar manualmente os convênios exibidos no painel e no site público.

alter table public.insurances
  add column display_order integer not null default 0;

-- Backfill: usa a ordem alfabética atual como ponto de partida para não
-- embaralhar a listagem existente.
with ordered as (
  select id, row_number() over (order by name) as rn
  from public.insurances
)
update public.insurances i
set display_order = ordered.rn
from ordered
where ordered.id = i.id;
