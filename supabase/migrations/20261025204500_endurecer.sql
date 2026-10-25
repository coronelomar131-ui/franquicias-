-- Las funciones de permiso salen del API público. Las políticas siguen funcionando
-- porque guardan la referencia a la función, no su nombre.
create schema if not exists privado;
grant usage on schema privado to authenticated;
alter function public.es_miembro(uuid) set schema privado;
alter function public.es_dueno(uuid) set schema privado;
revoke execute on function privado.es_miembro(uuid), privado.es_dueno(uuid) from public, anon;
grant execute on function privado.es_miembro(uuid), privado.es_dueno(uuid) to authenticated;

-- El folio solo lo usa el trigger
revoke execute on function public.asignar_folio() from public, anon, authenticated;

create or replace function public.guardar_empleado(p_restaurante uuid, p_id uuid, p_nombre text, p_rol text, p_pin text, p_activo boolean default true) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not privado.es_dueno(p_restaurante) then raise exception 'Solo el dueño puede administrar empleados'; end if;
  if p_pin is not null and p_pin !~ '^[0-9]{4,6}$' then raise exception 'El PIN debe tener de 4 a 6 números'; end if;
  if p_id is null then
    if p_pin is null then raise exception 'El empleado nuevo necesita PIN'; end if;
    insert into public.empleados (restaurante_id, nombre, rol, pin_hash, activo)
    values (p_restaurante, btrim(p_nombre), p_rol, extensions.crypt(p_pin, extensions.gen_salt('bf')), coalesce(p_activo, true))
    returning id into v_id;
  else
    update public.empleados set
      nombre = btrim(p_nombre), rol = p_rol, activo = coalesce(p_activo, activo),
      pin_hash = case when p_pin is null then pin_hash else extensions.crypt(p_pin, extensions.gen_salt('bf')) end,
      intentos_fallidos = case when p_pin is null then intentos_fallidos else 0 end,
      bloqueado_hasta = case when p_pin is null then bloqueado_hasta else null end
    where id = p_id and restaurante_id = p_restaurante
    returning id into v_id;
    if v_id is null then raise exception 'Empleado no encontrado'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.validar_pin(p_restaurante uuid, p_empleado uuid, p_pin text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare e record;
begin
  if not privado.es_miembro(p_restaurante) then raise exception 'Sin acceso a este restaurante'; end if;
  select * into e from public.empleados where id = p_empleado and restaurante_id = p_restaurante and activo for update;
  if not found then return false; end if;
  if e.bloqueado_hasta is not null and e.bloqueado_hasta > now() then
    raise exception 'Demasiados intentos. Espera unos minutos';
  end if;
  if e.pin_hash = extensions.crypt(coalesce(p_pin, ''), e.pin_hash) then
    update public.empleados set intentos_fallidos = 0, bloqueado_hasta = null where id = e.id;
    return true;
  end if;
  update public.empleados set
    intentos_fallidos = case when e.intentos_fallidos + 1 >= 5 then 0 else e.intentos_fallidos + 1 end,
    bloqueado_hasta = case when e.intentos_fallidos + 1 >= 5 then now() + interval '5 minutes' else null end
  where id = e.id;
  return false;
end;
$$;

-- Índices que cubren las llaves foráneas compuestas
drop index if exists public.comandas_orden_idx;
drop index if exists public.ordenes_mesa_idx;
drop index if exists public.pagos_orden_idx;
drop index if exists public.pagos_turno_idx;
drop index if exists public.productos_cat_idx;
drop index if exists public.renglones_comanda_idx;
drop index if exists public.renglones_orden_idx;
drop index if exists public.renglones_producto_idx;
create index comandas_orden_idx on public.comandas (orden_id, restaurante_id);
create index ordenes_mesa_idx on public.ordenes (mesa_id, restaurante_id);
create index pagos_orden_idx on public.pagos (orden_id, restaurante_id);
create index pagos_turno_idx on public.pagos (turno_id, restaurante_id);
create index productos_cat_idx on public.productos (categoria_id, restaurante_id);
create index renglones_comanda_idx on public.renglones (comanda_id, restaurante_id);
create index renglones_orden_idx on public.renglones (orden_id, restaurante_id);
create index renglones_producto_idx on public.renglones (producto_id, restaurante_id);
