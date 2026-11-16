-- Optional deposits: notify the client without leaking payment links.
-- Additive staging-only change pending release gates G0-G5 for production.
create or replace function public.notify_appointment_deposit_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.status = old.status
     and new.amount_cents = old.amount_cents
     and new.method = old.method
     and new.external_url is not distinct from old.external_url then
    return new;
  end if;
  if new.status = 'requested' then
    perform public.notify_user(
      new.client_id, 'deposit_requested',
      case when tg_op = 'INSERT' then 'Acompte demandé' else 'Acompte modifié' end,
      'Votre tatoueur a demandé un acompte pour votre rendez-vous. Le règlement se fait directement auprès de lui.',
      jsonb_build_object('appointment_id', new.appointment_id)
    );
  elsif new.status = 'declared_received' then
    perform public.notify_user(
      new.client_id, 'deposit_declared_received',
      'Acompte déclaré reçu',
      'Votre tatoueur déclare avoir reçu l’acompte. INKR n’a pas vérifié la transaction.',
      jsonb_build_object('appointment_id', new.appointment_id)
    );
  elsif new.status = 'waived' then
    perform public.notify_user(
      new.client_id, 'deposit_waived', 'Acompte non requis',
      'Votre tatoueur a renoncé à l’acompte pour ce rendez-vous.',
      jsonb_build_object('appointment_id', new.appointment_id)
    );
  end if;
  return new;
end;
$$;
revoke all on function public.notify_appointment_deposit_change() from public, anon, authenticated;
drop trigger if exists appointment_deposit_notice on public.appointment_deposit_requests;
create trigger appointment_deposit_notice
after insert or update on public.appointment_deposit_requests
for each row execute function public.notify_appointment_deposit_change();
comment on function public.notify_appointment_deposit_change() is
'Notifies the client of externally collected deposits; never includes payment URLs.';
