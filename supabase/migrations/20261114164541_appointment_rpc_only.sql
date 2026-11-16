-- Only the checked booking functions may change an appointment. The original
-- artist FOR ALL policy allowed a direct UPDATE to 'confirmed' before the
-- client accepted the proposed slot.
drop policy if exists "appointments_manage_artist" on public.appointments;
revoke insert, update, delete on public.appointments from public, anon, authenticated;
grant select on public.appointments to authenticated;
