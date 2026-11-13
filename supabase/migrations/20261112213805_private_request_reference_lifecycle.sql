-- Reference metadata stores a private object path, never a public or signed URL.
-- Keep historical rows readable; restrict new rows to the three app slots.
drop policy if exists "refs_insert_client" on public.request_references;
create policy "refs_insert_client" on public.request_references
  for insert to authenticated
  with check (
    url in (
      request_id::text || '/ref_0.jpg',
      request_id::text || '/ref_1.jpg',
      request_id::text || '/ref_2.jpg'
    )
    and exists (
      select 1 from public.tattoo_requests r
      where r.id = request_id and r.client_id = auth.uid()
    )
  );

create unique index if not exists request_references_private_path_unique
  on public.request_references (request_id, url)
  where url ~ '^[0-9a-f-]{36}/ref_[0-2]\.jpg$';

drop policy if exists "refs_delete_client" on public.request_references;
create policy "refs_delete_client" on public.request_references
  for delete to authenticated
  using (
    exists (
      select 1 from public.tattoo_requests r
      where r.id = request_id and r.client_id = auth.uid()
    )
  );

-- Storage policy is the quota boundary for names: only three flat JPEG slots.
drop policy if exists "inkr_request_refs_insert_client" on storage.objects;
create policy "inkr_request_refs_insert_client" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'request-references'
    and exists (
      select 1 from public.tattoo_requests r
      where r.client_id = auth.uid()
        and name in (
          r.id::text || '/ref_0.jpg',
          r.id::text || '/ref_1.jpg',
          r.id::text || '/ref_2.jpg'
        )
    )
  );

drop policy if exists "inkr_request_refs_update_client" on storage.objects;
create policy "inkr_request_refs_update_client" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'request-references'
    and exists (
      select 1 from public.tattoo_requests r
      where r.client_id = auth.uid()
        and name in (
          r.id::text || '/ref_0.jpg',
          r.id::text || '/ref_1.jpg',
          r.id::text || '/ref_2.jpg'
        )
    )
  )
  with check (
    bucket_id = 'request-references'
    and exists (
      select 1 from public.tattoo_requests r
      where r.client_id = auth.uid()
        and name in (
          r.id::text || '/ref_0.jpg',
          r.id::text || '/ref_1.jpg',
          r.id::text || '/ref_2.jpg'
        )
    )
  );

drop policy if exists "inkr_request_refs_delete_client" on storage.objects;
create policy "inkr_request_refs_delete_client" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'request-references'
    and exists (
      select 1 from public.tattoo_requests r
      where r.id::text = (storage.foldername(name))[1]
        and r.client_id = auth.uid()
    )
  );
