-- Let the frontend add customers and orders. Updates and deletes stay blocked.
-- Table constraints (unique email, valid status, non-negative amount, FKs) still apply.
grant insert on public.customers, public.orders to anon;

create policy "Public insert access" on public.customers
  for insert to anon with check (true);

create policy "Public insert access" on public.orders
  for insert to anon with check (true);
