begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select has_column('public', 'user_channels', 'telegram_chat_since', 'user_channels guarda desde cuándo cuenta la conversación');
select has_index('public', 'user_channels', 'user_channels_telegram_chat_idx', 'índice para encontrar el dueño de un chat');
select has_index('public', 'flow_runs', 'flow_runs_telegram_chat_idx', 'índice para el límite y el contexto de Telegram');
select ok(has_column_privilege('authenticated', 'public.user_channels', 'telegram_chat_since', 'select'), 'cada persona puede ver la columna');
select ok(not has_column_privilege('authenticated', 'public.user_channels', 'telegram_chat_since', 'update'), 'pero no escribirla');

select * from finish();
rollback;
