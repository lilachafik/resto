-- Read-only access for the frontend (publishable key = anon role).
-- Only SELECT is granted; inserts/updates/deletes stay blocked.
grant select on public.customers, public.restaurants, public.orders to anon;

create policy "Public read access" on public.customers
  for select to anon using (true);

create policy "Public read access" on public.restaurants
  for select to anon using (true);

create policy "Public read access" on public.orders
  for select to anon using (true);
