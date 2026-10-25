-- Marca del restaurante, fotos de platillos y envío a cocina
alter table public.restaurantes
  add column logo_url text check (char_length(logo_url) <= 500),
  add column color_marca text not null default 'achiote'
    check (color_marca in ('achiote', 'vino', 'nopal', 'talavera', 'mostaza', 'rosa', 'tinta'));
grant update (logo_url, color_marca) on public.restaurantes to authenticated;

alter table public.productos add column foto_url text check (char_length(foto_url) <= 500);

-- Imágenes públicas para leer; solo el dueño escribe, y solo en la carpeta de su restaurante (<restaurante_id>/...)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagenes', 'imagenes', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create function privado.carpeta_restaurante(nombre text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return (storage.foldername(nombre))[1]::uuid;
exception when others then
  return null;
end;
$$;
grant execute on function privado.carpeta_restaurante(text) to authenticated;

create policy "dueño sube imágenes de su restaurante" on storage.objects for insert to authenticated
  with check (bucket_id = 'imagenes' and privado.es_dueno(privado.carpeta_restaurante(name)));
create policy "dueño cambia imágenes de su restaurante" on storage.objects for update to authenticated
  using (bucket_id = 'imagenes' and privado.es_dueno(privado.carpeta_restaurante(name)))
  with check (bucket_id = 'imagenes' and privado.es_dueno(privado.carpeta_restaurante(name)));
create policy "dueño borra imágenes de su restaurante" on storage.objects for delete to authenticated
  using (bucket_id = 'imagenes' and privado.es_dueno(privado.carpeta_restaurante(name)));

-- Manda a cocina los renglones nuevos de una orden como una ronda nueva, en una sola operación
create function public.enviar_a_cocina(p_orden uuid, p_empleado uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  o record;
  v_ronda smallint;
  v_id uuid;
begin
  select * into o from public.ordenes where id = p_orden for update;
  if not found or not privado.es_miembro(o.restaurante_id) then raise exception 'Orden no encontrada'; end if;
  if o.estado <> 'abierta' then raise exception 'La orden ya está cerrada'; end if;
  if not exists (select 1 from public.renglones where orden_id = p_orden and comanda_id is null and not cancelado) then
    raise exception 'No hay productos nuevos para mandar';
  end if;
  select coalesce(max(ronda), 0) + 1 into v_ronda from public.comandas where orden_id = p_orden;
  insert into public.comandas (restaurante_id, orden_id, ronda, enviada_por)
  values (o.restaurante_id, p_orden, v_ronda, p_empleado) returning id into v_id;
  update public.renglones set comanda_id = v_id where orden_id = p_orden and comanda_id is null and not cancelado;
  return v_id;
end;
$$;
revoke execute on function public.enviar_a_cocina(uuid, uuid) from public, anon;
grant execute on function public.enviar_a_cocina(uuid, uuid) to authenticated;
