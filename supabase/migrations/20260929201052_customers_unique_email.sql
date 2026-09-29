-- Case-insensitive: Dana@Mail.com and dana@mail.com count as the same email
create unique index customers_email_unique on public.customers (lower(email));
