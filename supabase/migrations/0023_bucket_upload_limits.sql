-- Los buckets `branding`/`family-photos` (0017_storage_buckets.sql) se
-- crearon sin file_size_limit ni allowed_mime_types: Storage aceptaba
-- cualquier tamaño y cualquier tipo de archivo (un video de 500MB, un HTML,
-- lo que sea) desde una cuenta con permiso de escritura (dueño de la app o
-- admin de familia respectivamente). Cap a 5MB y solo imágenes — coincide
-- con el límite que ahora también valida el cliente antes de subir
-- (mobile/src/lib/imageUpload.ts).
update storage.buckets
set file_size_limit = 5242880, -- 5 MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id in ('branding', 'family-photos');
