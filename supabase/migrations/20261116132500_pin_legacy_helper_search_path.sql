-- Pin the lookup path of two legacy public helpers.
-- Both functions only call pg_catalog built-ins; no user-writable schema is needed.
-- This does not replace function bodies or change granted roles.
alter function public.guard_request_update() set search_path = pg_catalog;
alter function public.search_normalize(text) set search_path = pg_catalog;
