-- Images for customers (private) and restaurants (public).
-- Files live in Storage; the tables keep only the file path.

alter table public.customers add column avatar_path text;
alter table public.restaurants add column image_path text;

-- ---------- Buckets ----------

-- Customer photos are personal: private bucket, viewed through short-lived signed URLs
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

-- Restaurant photos are not sensitive: public bucket, anyone with the URL can view
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('restaurant-images', 'restaurant-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

-- ---------- Storage policies ----------
-- Avatar paths look like "<customer id>/<file>", so the first folder says whose photo it is.

create policy "Admin or owner can view avatars" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      or (storage.foldername(name))[1] = (select id::text from public.customers where user_id = (select auth.uid()))
    )
  );

create policy "Admin or owner can upload avatars" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (
      (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      or (storage.foldername(name))[1] = (select id::text from public.customers where user_id = (select auth.uid()))
    )
  );

create policy "Admin or owner can delete avatars" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      or (storage.foldername(name))[1] = (select id::text from public.customers where user_id = (select auth.uid()))
    )
  );

-- Public URLs work without a policy; these cover admin uploads and cleanup through the API
create policy "Admin can view restaurant images" on storage.objects
  for select to authenticated
  using (bucket_id = 'restaurant-images' and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admin can upload restaurant images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'restaurant-images' and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admin can delete restaurant images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'restaurant-images' and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ---------- Saving the path on the row ----------
-- Column-level grants: signed-in users may update ONLY the image column, nothing else.

grant update (avatar_path) on public.customers to authenticated;
grant update (image_path) on public.restaurants to authenticated;

create policy "Admin or owner can update customer photo" on public.customers
  for update to authenticated
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or user_id = (select auth.uid())
  )
  with check (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or user_id = (select auth.uid())
  );

create policy "Admin can update restaurant photo" on public.restaurants
  for update to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
