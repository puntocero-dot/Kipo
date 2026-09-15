-- Apariencia del login (fondo/colores), editable solo por el dueño de la
-- app — identificado por una fila en app_owners (no un correo hardcodeado
-- en el código, así se puede cambiar sin redeploy). La pantalla de login se
-- ve SIN sesión, así que login_branding debe poder leerse por cualquiera
-- (anon incluido) mientras que app_owners no debe poder leerse por nadie
-- directo (solo is_app_owner() la consulta, con security definer).

create table app_owners (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
-- RLS activo + cero policies = nadie puede leer/escribir esta tabla vía la
-- API, ni siquiera su propia fila — solo funciones security definer.
alter table app_owners enable row level security;

create or replace function is_app_owner()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from app_owners where auth_user_id = auth.uid());
$$;
grant execute on function is_app_owner() to authenticated, anon;

create table login_branding (
  id                    boolean primary key default true check (id), -- fila única (singleton)
  background_image_url  text,
  gradient_colors       text[],
  gradient_locations    numeric[],
  updated_at            timestamptz not null default now()
);
insert into login_branding (id) values (true);

alter table login_branding enable row level security;
-- Debe verse SIN sesión (pantalla de login) — por eso for select using (true).
create policy anyone_can_read_login_branding on login_branding
  for select using (true);
-- Sin policy de insert/update/delete a propósito: solo vía save_login_branding().

create or replace function save_login_branding(
  new_background_image_url text,
  new_gradient_colors text[],
  new_gradient_locations numeric[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_app_owner() then
    raise exception 'Solo el propietario de la app puede cambiar la apariencia del login.';
  end if;
  if new_gradient_colors is not null
     and array_length(new_gradient_colors, 1) is distinct from array_length(new_gradient_locations, 1) then
    raise exception 'gradient_colors y gradient_locations deben tener la misma longitud.';
  end if;

  update login_branding
  set background_image_url = new_background_image_url,
      gradient_colors = new_gradient_colors,
      gradient_locations = new_gradient_locations,
      updated_at = now()
  where id = true;
end;
$$;

grant execute on function save_login_branding(text, text[], numeric[]) to authenticated;
