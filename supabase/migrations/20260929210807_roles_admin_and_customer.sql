-- Two kinds of users:
--   admin    -> app_metadata.role = 'admin' : sees and adds everything
--   customer -> linked through customers.user_id : sees only their own record and orders
-- Roles live in app_metadata (only settable with the service key), never user_metadata.

alter table public.customers
  add column user_id uuid unique references auth.users (id) on delete set null;

-- Replace the "any signed-in user" policies
drop policy "Staff can read customers" on public.customers;
drop policy "Staff can read restaurants" on public.restaurants;
drop policy "Staff can read orders" on public.orders;
drop policy "Staff can add customers" on public.customers;
drop policy "Staff can add orders" on public.orders;

create policy "Admin or own record" on public.customers
  for select to authenticated
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or user_id = (select auth.uid())
  );

-- Restaurant names and addresses are not private
create policy "Signed-in users can read restaurants" on public.restaurants
  for select to authenticated
  using (true);

create policy "Admin or own orders" on public.orders
  for select to authenticated
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or customer_id in (select id from public.customers where user_id = (select auth.uid()))
  );

create policy "Admin can add customers" on public.customers
  for insert to authenticated
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admin can add orders" on public.orders
  for insert to authenticated
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
