-- Colores libres (cualquier color, guardado en hex) y foto de cada persona del equipo
alter table public.restaurantes
  add column if not exists color_principal text check (color_principal ~ '^#[0-9a-f]{6}$'),
  add column if not exists color_secundario text check (color_secundario ~ '^#[0-9a-f]{6}$'),
  add column if not exists color_fondo text check (color_fondo ~ '^#[0-9a-f]{6}$');
grant update (color_principal, color_secundario, color_fondo) on public.restaurantes to authenticated;

alter table public.empleados
  add column if not exists foto_url text check (foto_url is null or char_length(foto_url) <= 500);
grant select (foto_url) on public.empleados to authenticated;
grant update (foto_url) on public.empleados to authenticated;
create policy "dueno cambia la foto del equipo" on public.empleados for update to authenticated
  using (privado.es_dueno(restaurante_id)) with check (privado.es_dueno(restaurante_id));
