create table public.restaurants (
  id bigint generated always as identity primary key,
  name text not null,
  address text,
  phone text
);

-- Each order links one customer to one restaurant
create table public.orders (
  id bigint generated always as identity primary key,
  customer_id bigint not null references public.customers (id),
  restaurant_id bigint not null references public.restaurants (id),
  created_at timestamptz not null default now(),
  total_amount numeric(10, 2) not null check (total_amount >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'preparing', 'delivered', 'cancelled'))
);

-- Postgres does not index foreign keys automatically
create index orders_customer_id_idx on public.orders (customer_id);
create index orders_restaurant_id_idx on public.orders (restaurant_id);

-- Block access through the public API until explicit policies are added
alter table public.restaurants enable row level security;
alter table public.orders enable row level security;
