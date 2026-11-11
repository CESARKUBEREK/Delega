-- Catálogo de planes con IA incluida (decisiones de Cesar, 11 nov).
-- Ver claude/spec-precios-ia-incluida.md (proyecto), secciones 2 y 3.1.
-- Los code no cambian (solo, pro, business); cambian nombres y precios.
-- Nadie paga todavía: los precios anteriores se cierran sin migrar suscripciones.

update public.billing_plans set
  name = 'MarchaSolo Solo',
  description = 'Para quien trabaja solo y quiere quitarse tareas de encima.',
  updated_at = now()
where code = 'solo';

update public.billing_plans set
  name = 'MarchaSolo Negocio',
  description = 'Para atender a tus clientes por WhatsApp y coordinar varias aplicaciones.',
  updated_at = now()
where code = 'pro';

update public.billing_plans set
  name = 'MarchaSolo Equipo',
  description = 'Para inmobiliarias y despachos con varias personas.',
  updated_at = now()
where code = 'business';

-- Cerrar los precios anteriores (19/39/79 USD; anual = 12 meses).
update public.plan_prices pp
   set valid_until = now()
  from public.billing_plans p
 where p.id = pp.plan_id
   and p.code in ('solo', 'pro', 'business')
   and pp.market_code = 'GLOBAL' and pp.currency = 'USD'
   and (pp.valid_until is null or pp.valid_until > now())
   and (pp.interval_unit, pp.amount_minor) not in (('month', 1900), ('year', 19000), ('month', 4900), ('year', 49000), ('month', 9900), ('year', 99000));

-- Precios nuevos: anual = 10 meses (2 gratis). El precio en ARS se añadirá
-- cuando Cesar fije el importe (market_code 'AR', currency 'ARS').
insert into public.plan_prices (plan_id, market_code, currency, amount_minor, interval_unit, interval_count, valid_from)
select p.id, 'GLOBAL', 'USD', v.amount_minor, v.interval_unit, 1, now()
  from public.billing_plans p
  join (values
    ('solo', 1900::bigint, 'month'::text),
    ('solo', 19000::bigint, 'year'::text),
    ('pro', 4900::bigint, 'month'::text),
    ('pro', 49000::bigint, 'year'::text),
    ('business', 9900::bigint, 'month'::text),
    ('business', 99000::bigint, 'year'::text)
  ) as v(plan_code, amount_minor, interval_unit) on v.plan_code = p.code
 where not exists (
   select 1 from public.plan_prices pp
    where pp.plan_id = p.id and pp.market_code = 'GLOBAL' and pp.currency = 'USD'
      and pp.amount_minor = v.amount_minor and pp.interval_unit = v.interval_unit
      and pp.interval_count = 1 and (pp.valid_until is null or pp.valid_until > now())
 );
