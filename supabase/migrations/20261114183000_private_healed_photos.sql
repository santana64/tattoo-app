-- A row hidden by healed_photos RLS must not point at a publicly readable object.
-- Keep legacy full public URLs in existing rows; the client extracts their path
-- and signs them after this bucket becomes private.
update storage.buckets set public = false where id = 'healed-photos';

create or replace function public.guard_healed_photo()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  appt public.appointments;
begin
  select * into appt from public.appointments where id = new.appointment_id;
  if not found or appt.client_id is distinct from auth.uid() or appt.status <> 'completed' then
    raise exception 'not_completed_session' using errcode = '42501';
  end if;
  -- New records use a private Storage path under the client's own folder.
  -- Existing full URLs remain readable through the SELECT policy below.
  if new.photo_url !~ ('^' || auth.uid()::text || '/[0-9]+\.jpg$') then
    raise exception 'invalid_healed_photo_path' using errcode = '42501';
  end if;
  new.artist_id := appt.artist_id;
  new.client_id := appt.client_id;
  new.note := nullif(left(trim(coalesce(new.note, '')), 300), '');
  return new;
end;
$$;

drop policy if exists "inkr_healed_photos_select_visible" on storage.objects;
create policy "inkr_healed_photos_select_visible" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'healed-photos'
    and (
      -- The owner can verify and remove an upload before its DB row exists.
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.healed_photos hp
        where hp.photo_url = storage.objects.name
          or right(hp.photo_url, length('/storage/v1/object/public/healed-photos/' || storage.objects.name))
            = '/storage/v1/object/public/healed-photos/' || storage.objects.name
      )
    )
  );
