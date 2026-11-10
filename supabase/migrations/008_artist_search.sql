-- ============================================================
-- INKR — Server-side artist search with pagination
--
-- Before: the app downloaded the first 60 artists and filtered them in the
-- browser, so artist number 61 could never be found.
-- After: search_artists() filters, sorts and pages in the database, and
-- returns the total number of matches with every row.
--
-- The function runs with the caller's rights (security invoker): it reads
-- only the public artist columns granted in migration 005.
-- Idempotent: safe to run more than once.
-- ============================================================

-- Lower-case, accent-free text so "Réalisme", "realisme" and "RÉALISME" match.
-- IMMUTABLE on purpose (unlike unaccent()), so it can back an index.
create or replace function public.search_normalize(p_text text)
returns text
language sql immutable parallel safe as $$
  select translate(
    lower(coalesce(p_text, '')),
    'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ',
    'aaaaaaceeeeiiiinooooouuuuyy'
  );
$$;

create or replace function public.search_artists(
  p_query text default null,
  p_style text default null,
  p_availability text default null,
  p_budget_max integer default null,
  p_sort text default 'relevance',
  p_limit integer default 24,
  p_offset integer default 0
) returns table (
  id uuid,
  blaze text,
  city text,
  bio text,
  cover_url text,
  avatar_url text,
  styles text[],
  specialties text[],
  booking_status text,
  min_budget integer,
  tier text,
  is_verified boolean,
  exclusions text[],
  rules text,
  process text,
  show_min_budget boolean,
  stat_posts integer,
  stat_profile_views integer,
  stat_requests_month integer,
  total_count bigint,
  open_count bigint
)
language sql stable security invoker set search_path = public as $$
  with input as (
    select
      -- The term is matched with LIKE: escape its wildcards so "%" finds nothing special.
      nullif(
        replace(replace(replace(
          replace(trim(public.search_normalize(p_query)), '-', ' '),
          '\', '\\'), '%', '\%'), '_', '\_'),
        ''
      ) as term,
      nullif(trim(public.search_normalize(p_style)), '') as style
  ),
  matched as (
    select a.id, a.blaze, a.city, a.bio, a.cover_url, a.avatar_url, a.styles, a.specialties,
           a.booking_status, a.min_budget, a.tier, a.is_verified, a.exclusions, a.rules, a.process,
           a.show_min_budget, a.stat_posts, a.stat_profile_views, a.stat_requests_month
    from public.artists a
    cross join input i
    where (
        i.term is null
        or replace(public.search_normalize(a.blaze || ' ' || a.city), '-', ' ') like '%' || i.term || '%'
        or exists (
          select 1 from unnest(a.styles) s
          where replace(public.search_normalize(s), '-', ' ') like '%' || i.term || '%'
        )
      )
      and (
        i.style is null
        or exists (
          select 1 from unnest(a.styles) s
          where replace(public.search_normalize(s), ' ', '-') = i.style
        )
      )
      and (
        p_availability is null
        or p_availability not in ('open', 'paused', 'closed')
        or a.booking_status = p_availability
      )
      and (
        p_budget_max is null
        -- An artist without a public minimum budget is excluded when a cap is set.
        or (coalesce(a.show_min_budget, false) and a.min_budget > 0 and a.min_budget <= p_budget_max)
      )
  )
  select m.id, m.blaze, m.city, m.bio, m.cover_url, m.avatar_url, m.styles, m.specialties,
         m.booking_status, m.min_budget, m.tier, m.is_verified, m.exclusions, m.rules, m.process,
         m.show_min_budget, m.stat_posts, m.stat_profile_views, m.stat_requests_month,
         count(*) over () as total_count,
         count(*) filter (where m.booking_status = 'open') over () as open_count
  from matched m
  order by
    case when p_sort = 'open' then (m.booking_status = 'open') end desc nulls last,
    case when p_sort = 'budget_asc' and coalesce(m.show_min_budget, false) then nullif(m.min_budget, 0) end asc nulls last,
    (m.tier = 'premium') desc,
    m.stat_profile_views desc nulls last,
    m.id
  limit least(greatest(coalesce(p_limit, 24), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.search_normalize(text) to anon, authenticated;
grant execute on function public.search_artists(text, text, text, integer, text, integer, integer) to anon, authenticated;

-- Trigram index for the name / city match. An optimisation only: if pg_trgm
-- is not reachable from this session, the search still works without it.
do $$
begin
  create index if not exists artists_search_trgm_idx on public.artists
    using gin (replace(public.search_normalize(blaze || ' ' || city), '-', ' ') gin_trgm_ops);
exception when others then
  raise notice 'artists_search_trgm_idx not created (%).', sqlerrm;
end;
$$;
