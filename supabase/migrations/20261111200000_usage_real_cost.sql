-- Costo real de cada llamada y quién lo paga.
-- cost_usd sigue siendo lo que gasta el CLIENTE (presupuesto del router, ai_spend,
-- pantallas): con la clave de MarchaSolo (prueba gratuita) vale 0. Hasta ahora ese
-- costo no quedaba en ningún sitio de usage_events. real_cost_usd guarda siempre
-- tokens × precio del catálogo, y funded_by dice quién lo paga.

alter table public.usage_events
  add column if not exists real_cost_usd numeric(12, 6) not null default 0 check (real_cost_usd >= 0),
  add column if not exists funded_by text not null default 'workspace' check (funded_by in ('workspace', 'marchasolo'));

comment on column public.usage_events.real_cost_usd is
  'Costo real estimado de la llamada (tokens × precio de llm_models), lo pague quien lo pague.';
comment on column public.usage_events.funded_by is
  'Quién paga la llamada: workspace (IA propia) o marchasolo (prueba gratuita / IA incluida).';

-- Histórico: costo real desde el catálogo.
update public.usage_events u
   set real_cost_usd = round((
         greatest(u.input_tokens - coalesce(u.cached_tokens, 0), 0) * m.price_in
       + coalesce(u.cached_tokens, 0) * coalesce(m.price_cached_in, m.price_in)
       + u.output_tokens * m.price_out
       ) / 1000000.0, 6)
  from public.llm_models m
 where m.provider = u.provider and m.model = u.model
   and u.real_cost_usd = 0;

-- Donde ya había costo apuntado, ese manda (incluye razonamiento y escrituras de caché).
update public.usage_events
   set real_cost_usd = cost_usd
 where cost_usd > 0;

-- Llamadas con tokens y sin costo desde el router (2 nov): son de la clave de MarchaSolo.
update public.usage_events
   set funded_by = 'marchasolo'
 where cost_usd = 0
   and (input_tokens > 0 or output_tokens > 0)
   and created_at >= '2026-11-02';

create index if not exists usage_events_funded_created_idx
  on public.usage_events (funded_by, created_at desc);
