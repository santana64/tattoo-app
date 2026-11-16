-- Equal, bounded portfolio samples for a page of artists. The former global
-- limit could be filled entirely by one prolific artist.
create index if not exists posts_artist_preview_idx on public.posts
  (artist_id, published_at desc, id desc)
  where is_published = true and media_type = 'photo';

create or replace function public.artist_portfolio_previews(
  p_artist_ids uuid[], p_per_artist integer default 3
) returns table (artist_id uuid, media_url text)
language sql stable security invoker set search_path = public as $$
  select requested.artist_id, preview.media_url
  from (
    select distinct artist_id
    from unnest(coalesce(p_artist_ids, '{}'::uuid[])) as ids(artist_id)
    where artist_id is not null
    limit 50
  ) requested
  cross join lateral (
    select p.media_url
    from public.posts p
    where p.artist_id = requested.artist_id
      and p.is_published = true and p.media_type = 'photo'
    order by p.published_at desc nulls last, p.id desc
    limit least(greatest(coalesce(p_per_artist, 3), 1), 3)
  ) preview;
$$;

revoke all on function public.artist_portfolio_previews(uuid[], integer) from public;
grant execute on function public.artist_portfolio_previews(uuid[], integer) to anon, authenticated;
