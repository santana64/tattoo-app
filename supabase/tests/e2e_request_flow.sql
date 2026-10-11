-- INKR end-to-end flow test, run as the real users through RLS.
-- Everything is rolled back at the end by raising the report as an exception.
do $$
declare
  v_req uuid; v_client uuid; v_artist_profile uuid; v_artist uuid; v_out uuid; v_appt uuid;
  report text := ''; n int; s text;
begin
  select id into v_req from public.tattoo_requests where id::text like 'b925dede%';
  select id into v_client from public.profiles where display_name = 'bruno';
  select profile_id, id into v_artist_profile, v_artist from public.artists where blaze = 'pucci';
  select id into v_out from public.profiles where display_name = 'noah';
  report := 'demande=' || left(v_req::text, 8) || ' statut=' || (select status from public.tattoo_requests where id = v_req) || E'\n';

  -- ── 1. Artist accepts (same UPDATE as request-store.updateStatus) ──
  perform set_config('request.jwt.claims', json_build_object('sub', v_artist_profile, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    update public.tattoo_requests set status = 'accepted', accepted_at = now()
    where id = v_req and artist_id = v_artist and status = 'submitted';
    get diagnostics n = row_count;
    report := report || '1 OK  artiste accepte la demande (' || n || ' ligne)' || E'\n';
  exception when others then report := report || '1 KO  artiste accepte : ' || sqlerrm || E'\n'; end;

  -- ── 2. Client writes a message ──
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_client, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    insert into public.messages (request_id, sender_id, content, message_type)
    values (v_req, v_client, 'Bonjour, vous avez des disponibilités en novembre ?', 'text');
    report := report || '2 OK  client envoie un message' || E'\n';
  exception when others then report := report || '2 KO  client envoie un message : ' || sqlerrm || E'\n'; end;

  -- ── 3. Artist replies ──
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_artist_profile, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    insert into public.messages (request_id, sender_id, content, message_type)
    values (v_req, v_artist_profile, 'Oui, je vous propose un créneau.', 'text');
    report := report || '3 OK  artiste répond' || E'\n';
  exception when others then report := report || '3 KO  artiste répond : ' || sqlerrm || E'\n'; end;

  -- ── 4. Artist proposes a slot (RPC used by the app) ──
  begin
    select id into v_appt from public.propose_appointment(v_req, now() + interval '2 days', now() + interval '2 days 3 hours', 'Prévoir 30 min de dessin');
    report := report || '4 OK  artiste propose un créneau (statut ' || (select status from public.appointments where id = v_appt) || ')' || E'\n';
  exception when others then report := report || '4 KO  proposition : ' || sqlerrm || E'\n'; end;

  -- ── 5. Client reads the thread and sees the proposal ──
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_client, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.messages where request_id = v_req;
  report := report || '5 ' || (case when n >= 2 then 'OK' else 'KO' end) || '  client voit ' || n || ' messages' || E'\n';
  select count(*) into n from public.appointments where id = v_appt;
  report := report || '5 ' || (case when n = 1 then 'OK' else 'KO' end) || '  client voit la proposition' || E'\n';

  -- ── 6. Client cannot close the session ──
  begin
    perform public.complete_appointment(v_appt);
    report := report || '6 KO  le client a pu clôturer la séance !' || E'\n';
  exception when others then report := report || '6 OK  client refusé pour clôturer (' || sqlerrm || ')' || E'\n'; end;

  -- ── 7. Client accepts the slot ──
  begin
    perform public.respond_to_appointment(v_appt, true);
    report := report || '7 OK  client accepte : rdv=' || (select status from public.appointments where id = v_appt)
      || ' demande=' || (select status from public.tattoo_requests where id = v_req) || E'\n';
  exception when others then report := report || '7 KO  acceptation : ' || sqlerrm || E'\n'; end;

  -- ── 8. Outsider sees nothing and cannot write ──
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_out, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.tattoo_requests where id = v_req;
  report := report || '8 ' || (case when n = 0 then 'OK' else 'KO' end) || '  compte tiers voit la demande : ' || n || E'\n';
  begin
    insert into public.messages (request_id, sender_id, content, message_type) values (v_req, v_out, 'intrus', 'text');
    report := report || '8 KO  compte tiers a pu écrire dans la conversation !' || E'\n';
  exception when others then report := report || '8 OK  compte tiers refusé en écriture' || E'\n'; end;

  -- ── 9. Time passes: the session happened (admin-only adjustment, rolled back) ──
  execute 'reset role';
  update public.appointments set starts_at = now() - interval '4 hours', ends_at = now() - interval '1 hour' where id = v_appt;

  -- ── 10. Artist marks it done ──
  perform set_config('request.jwt.claims', json_build_object('sub', v_artist_profile, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.complete_appointment(v_appt);
    report := report || '10 OK artiste clôture : rdv=' || (select status from public.appointments where id = v_appt)
      || ' demande=' || (select status from public.tattoo_requests where id = v_req) || E'\n';
  exception when others then report := report || '10 KO clôture : ' || sqlerrm || E'\n'; end;

  -- ── 11. Audit: can the client change the request status directly? ──
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_client, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    update public.tattoo_requests set status = 'archived' where id = v_req;
    get diagnostics n = row_count;
    report := report || '11 ' || (case when n = 0 then 'OK  client ne peut pas modifier le statut' else 'ALERTE client a modifié le statut directement (' || n || ' ligne)' end) || E'\n';
  exception when others then report := report || '11 OK client refusé pour modifier le statut' || E'\n'; end;

  execute 'reset role';
  raise exception E'RAPPORT (tout est annulé)\n%', report;
end $$;
