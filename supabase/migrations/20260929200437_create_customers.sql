create table public.customers (
  id bigint generated always as identity primary key,
  name text not null,
  email text,
  phone text,
  address text
);

-- Block access through the public API until explicit policies are added
alter table public.customers enable row level security;
