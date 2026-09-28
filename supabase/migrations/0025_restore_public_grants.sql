-- Restaura los privilegios base de tabla/secuencia sobre el schema `public`
-- para los roles `anon`/`authenticated`/`service_role`.
--
-- Contexto: un proyecto de Supabase nuevo trae estos privilegios ya puestos
-- por la plataforma al crearse (fuera de cualquier migración nuestra) — por
-- eso ninguna migración anterior (0001-0024) tuvo que otorgarlos: Postgres
-- exige el GRANT de tabla ademas de que la política RLS lo permita, y ese
-- grant ya venía dado. Si alguna vez se resetea el schema public a mano
-- (drop schema public cascade; create schema public;) para reaplicar
-- database/schema.sql desde cero, ese reset también borra esos privilegios
-- por defecto de la plataforma — y entonces toda la REST API empieza a
-- responder 401/403 aunque las políticas RLS estén perfectas, porque el
-- permiso base nunca se vuelve a poner solo.
--
-- Este archivo lo repone explícitamente (y dentro de la transacción de
-- database/schema.sql para que un reset completo futuro no repita el
-- problema). A propósito NO toca privilegios de funciones: cada función
-- SECURITY DEFINER ya maneja su propio grant/revoke de EXECUTE por
-- separado (ver 0019_revoke_anon_execute.sql y las funciones de
-- 0024_private_rls_helpers.sql) — un grant genérico aquí reabriría RPCs que
-- se cerraron a propósito.
--
-- La seguridad real de los datos sigue siendo enteramente las políticas RLS
-- ya existentes; esto solo repone el permiso de acceso base que Postgres
-- evalúa antes de llegar a evaluar RLS.

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
