-- Canal de WhatsApp para Kipobot (api/whatsapp.js).
--
-- whatsapp_links: qué número de teléfono le pertenece a qué persona y a cuál
-- de sus espacios se registran los gastos por defecto. El vínculo es por
-- persona (auth.users), no por espacio, porque una persona puede tener
-- varios espacios — `family_id` es solo el espacio activo para WhatsApp.
--
-- whatsapp_link_codes: códigos de un solo uso (15 min) que genera la app
-- ("Más → WhatsApp") y que la persona manda por WhatsApp ("VINCULAR AB12CD34")
-- para demostrar que el número es suyo.
--
-- Solo el webhook (service_role, que se salta RLS) crea/modifica vínculos;
-- el cliente solo puede ver y borrar los suyos y pedir un código por RPC.
-- `pending` guarda la conversación a medias cuando Kipobot pregunta algo.

create table whatsapp_links (
  phone           text primary key, -- solo dígitos, con código de país (formato de Meta, ej. 50370001234)
  auth_user_id    uuid not null references auth.users(id) on delete cascade,
  family_id       uuid not null references families(id) on delete cascade,
  pending         jsonb,
  pending_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index idx_whatsapp_links_user on whatsapp_links (auth_user_id);
create index idx_whatsapp_links_family on whatsapp_links (family_id);

alter table whatsapp_links enable row level security;

create policy whatsapp_links_select_own on whatsapp_links
  for select to authenticated using (auth_user_id = auth.uid());
create policy whatsapp_links_delete_own on whatsapp_links
  for delete to authenticated using (auth_user_id = auth.uid());

create table whatsapp_link_codes (
  code            text primary key,
  auth_user_id    uuid not null references auth.users(id) on delete cascade,
  family_id       uuid not null references families(id) on delete cascade,
  expires_at      timestamptz not null
);

create index idx_whatsapp_link_codes_user on whatsapp_link_codes (auth_user_id);
create index idx_whatsapp_link_codes_family on whatsapp_link_codes (family_id);

-- Sin policies: ningún rol de cliente la lee ni escribe directo.
alter table whatsapp_link_codes enable row level security;

create or replace function create_whatsapp_link_code(target_family_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if not exists (
    select 1 from users
    where family_id = target_family_id and auth_user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'No perteneces a este espacio';
  end if;

  delete from whatsapp_link_codes where auth_user_id = auth.uid() or expires_at < now();

  new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into whatsapp_link_codes (code, auth_user_id, family_id, expires_at)
  values (new_code, auth.uid(), target_family_id, now() + interval '15 minutes');

  return new_code;
end;
$$;

revoke execute on function create_whatsapp_link_code(uuid) from public;
revoke execute on function create_whatsapp_link_code(uuid) from anon;
grant execute on function create_whatsapp_link_code(uuid) to authenticated;
