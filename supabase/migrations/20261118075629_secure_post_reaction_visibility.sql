-- INKR V5.1 staging: prevent exposure of reactions on unpublished posts.
-- Published-post reactions remain public; the owning artist can still inspect draft reactions.
drop policy if exists reactions_select_all on public.post_reactions;
drop policy if exists reactions_select_visible_posts on public.post_reactions;

create policy reactions_select_visible_posts
on public.post_reactions
for select to anon, authenticated
using (
  exists (
    select 1
    from public.posts p
    where p.id = post_reactions.post_id
      and (
        p.is_published is true
        or exists (
          select 1
          from public.artists a
          where a.id = p.artist_id
            and a.profile_id = (select auth.uid())
        )
      )
  )
);

-- SECURITY DEFINER bypasses row policies: explicitly enforce post visibility here too.
create or replace function public.post_reaction_counts(p_post_ids uuid[])
returns table(post_id uuid, emoji text, total integer)
language sql stable security definer
set search_path = ''
as $function$
  select r.post_id, r.emoji, count(*)::int as total
  from public.post_reactions r
  join public.posts p on p.id = r.post_id
  where r.post_id = any (p_post_ids[1:60])
    and (
      p.is_published is true
      or exists (
        select 1
        from public.artists a
        where a.id = p.artist_id
          and a.profile_id = (select auth.uid())
      )
    )
  group by r.post_id, r.emoji;
$function$;
