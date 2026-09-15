-- Dos buckets públicos de Storage:
--   - `branding`: fondo de la pantalla de login — debe poder leerse SIN
--     sesión (se ve antes de iniciar sesión), solo el dueño de la app
--     puede escribir ahí (is_app_owner(), ver 0014_login_branding.sql).
--   - `family-photos`: foto de familia — igual que el resto de los datos de
--     una familia, se queda dentro del mismo círculo de confianza (ver
--     docs/SECURITY_AUDIT.md hallazgo #6), público-lectura es suficiente,
--     sin necesidad de URLs firmadas; solo un admin de esa familia puede
--     escribir en su propia carpeta.

insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('family-photos', 'family-photos', true)
on conflict (id) do nothing;

create policy branding_public_read on storage.objects
  for select using (bucket_id = 'branding');
create policy branding_owner_write on storage.objects
  for insert to authenticated with check (bucket_id = 'branding' and is_app_owner());
create policy branding_owner_update on storage.objects
  for update to authenticated using (bucket_id = 'branding' and is_app_owner());

-- Convención de ruta: family-photos/<family_id>/photo.jpg — el primer
-- segmento del path es el family_id, así la policy puede verificar que
-- quien sube la foto es admin de ESA familia sin necesitar una tabla aparte.
create policy family_photos_public_read on storage.objects
  for select using (bucket_id = 'family-photos');
create policy family_photos_admin_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'family-photos' and (storage.foldername(name))[1]::uuid in (select my_admin_family_ids()));
create policy family_photos_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'family-photos' and (storage.foldername(name))[1]::uuid in (select my_admin_family_ids()));
