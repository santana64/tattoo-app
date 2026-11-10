-- ============================================================
-- INKR — Deliver notifications as push messages
--
-- Every row inserted in public.notifications (migration 006) is forwarded to
-- the `send-push` edge function, which sends it to the user's devices.
--
-- The call is asynchronous (pg_net) and best effort: a missing configuration
-- or a failing push never blocks or rolls back the notification itself.
--
-- One-time setup, in the Supabase SQL Editor (values are stored encrypted in
-- Vault, never in a migration):
--
--   select vault.create_secret(
--     'https://<project-ref>.supabase.co/functions/v1/send-push', 'push_function_url');
--   select vault.create_secret('<service role key>', 'push_service_role_key');
--
-- Until both secrets exist, the trigger does nothing.
-- Idempotent: safe to run more than once.
-- ============================================================

-- pg_net ships with hosted Supabase; local or test databases may not have it.
do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net is not available here: push delivery stays disabled (%).', sqlerrm;
end;
$$;

create or replace function public.push_notification()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_key text;
begin
  if to_regnamespace('net') is null or to_regclass('vault.decrypted_secrets') is null then
    return null;
  end if;

  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
    into v_url using 'push_function_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
    into v_key using 'push_service_role_key';
  if coalesce(v_url, '') = '' or coalesce(v_key, '') = '' then
    return null;
  end if;

  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using
      v_url,
      jsonb_build_object(
        'userId', new.user_id,
        'title', new.title,
        'body', new.body,
        'data', coalesce(new.data, '{}'::jsonb) || jsonb_build_object('type', new.type, 'notification_id', new.id)
      ),
      jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key);
  return null;
exception when others then
  -- The in-app notification must survive any push problem.
  raise warning 'push_notification: delivery not queued (%).', sqlerrm;
  return null;
end;
$$;

revoke all on function public.push_notification() from public, anon, authenticated;

drop trigger if exists trg_push_notification on public.notifications;
create trigger trg_push_notification
  after insert on public.notifications
  for each row execute function public.push_notification();
