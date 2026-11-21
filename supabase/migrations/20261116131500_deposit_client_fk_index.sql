-- V5.1: index the client foreign key to avoid table scans when clients
-- are removed and to support client-scoped lookups as deposit volume grows.
-- Additive; staging only until production release gates G0-G5 are cleared.
create index if not exists appointment_deposit_requests_client_idx
  on public.appointment_deposit_requests (client_id);
