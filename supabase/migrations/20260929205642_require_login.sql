-- Only signed-in staff can use the data. Anonymous visitors lose all access.

drop policy "Public read access" on public.customers;
drop policy "Public read access" on public.restaurants;
drop policy "Public read access" on public.orders;
drop policy "Public insert access" on public.customers;
drop policy "Public insert access" on public.orders;

revoke all on public.customers, public.restaurants, public.orders from anon;

-- Signed-in users: read everything, add customers and orders. No updates or deletes.
revoke all on public.customers, public.restaurants, public.orders from authenticated;
grant select on public.customers, public.restaurants, public.orders to authenticated;
grant insert on public.customers, public.orders to authenticated;

create policy "Staff can read customers" on public.customers
  for select to authenticated using (true);

create policy "Staff can read restaurants" on public.restaurants
  for select to authenticated using (true);

create policy "Staff can read orders" on public.orders
  for select to authenticated using (true);

create policy "Staff can add customers" on public.customers
  for insert to authenticated with check (true);

create policy "Staff can add orders" on public.orders
  for insert to authenticated with check (true);
