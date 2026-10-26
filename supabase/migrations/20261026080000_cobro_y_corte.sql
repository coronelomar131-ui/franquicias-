-- Cobro de cuentas (todo junto o por comensal), turnos de caja y corte.
-- Quién cobra o abre caja sale de la sesión (app_metadata.empleado_id), no de lo que mande la app.

-- Dueño, o alguien del equipo con puesto de caja o gerente
create or replace function privado.puede_caja(r uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select privado.es_dueno(r) or exists (
    select 1 from public.empleados e join public.miembros m on m.user_id = e.usuario_id and m.restaurante_id = e.restaurante_id
    where e.restaurante_id = r and e.usuario_id = (select auth.uid()) and e.rol in ('caja', 'gerente') and e.activo);
$$;
revoke execute on function privado.puede_caja(uuid) from public, anon;
grant execute on function privado.puede_caja(uuid) to authenticated;

create or replace function privado.empleado_actual() returns uuid
language sql stable set search_path = '' as $$
  select nullif((select auth.jwt()) -> 'app_metadata' ->> 'empleado_id', '')::uuid;
$$;
grant execute on function privado.empleado_actual() to authenticated;

-- ── Cobrar ─────────────────────────────────────────────────────────────
-- p_comensales: null = toda la cuenta; si no, solo lo de esos comensales (para dividir la cuenta)
create or replace function public.cobrar(p_orden uuid, p_metodo text, p_propina integer default 0, p_recibido integer default null, p_comensales smallint[] default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o record; v_turno uuid; v_total integer; v_ids uuid[]; v_pago uuid; v_restan integer;
  v_emp uuid := privado.empleado_actual();
  v_prop integer := coalesce(p_propina, 0);
begin
  select * into o from public.ordenes where id = p_orden for update;
  if not found or not privado.es_miembro(o.restaurante_id) then raise exception 'Sin acceso a esta cuenta'; end if;
  if o.estado <> 'abierta' then raise exception 'Esta cuenta ya se cerró'; end if;
  if p_metodo not in ('efectivo', 'tarjeta', 'transferencia') then raise exception 'Forma de pago no válida'; end if;
  if v_prop < 0 or v_prop > 10000000 then raise exception 'Propina no válida'; end if;
  if exists (select 1 from public.renglones where orden_id = p_orden and not cancelado and comanda_id is null) then
    raise exception 'Hay platillos sin mandar a cocina. Mándalos o quítalos antes de cobrar';
  end if;
  select array_agg(id), coalesce(sum(precio_centavos * cantidad), 0) into v_ids, v_total
    from public.renglones
   where orden_id = p_orden and not cancelado and not pagado and (p_comensales is null or comensal = any (p_comensales));
  if v_total <= 0 then raise exception 'No hay nada por cobrar'; end if;
  if p_metodo = 'efectivo' and coalesce(p_recibido, 0) < v_total + v_prop then raise exception 'Lo recibido no alcanza para el total'; end if;

  -- Si nadie abrió caja, se abre sola con fondo en cero para no detener el servicio
  select id into v_turno from public.turnos where restaurante_id = o.restaurante_id and cerrado_en is null;
  if v_turno is null then
    insert into public.turnos (restaurante_id, abierto_por) values (o.restaurante_id, v_emp) returning id into v_turno;
  end if;

  insert into public.pagos (restaurante_id, orden_id, turno_id, monto_centavos, propina_centavos, metodo, recibido_centavos, cobrado_por)
  values (o.restaurante_id, p_orden, v_turno, v_total, v_prop, p_metodo, case when p_metodo = 'efectivo' then p_recibido end, v_emp)
  returning id into v_pago;
  update public.renglones set pagado = true where id = any (v_ids);

  select coalesce(sum(precio_centavos * cantidad), 0) into v_restan
    from public.renglones where orden_id = p_orden and not cancelado and not pagado;
  if v_restan = 0 then
    update public.ordenes set estado = 'pagada', cerrada_en = now() where id = p_orden;
  end if;

  return jsonb_build_object('pago_id', v_pago, 'total', v_total, 'propina', v_prop,
    'cambio', case when p_metodo = 'efectivo' then p_recibido - v_total - v_prop else 0 end,
    'restan', v_restan, 'cerrada', v_restan = 0, 'turno_id', v_turno);
end;
$$;

-- ── Turnos de caja ─────────────────────────────────────────────────────
create or replace function public.abrir_turno(p_restaurante uuid, p_fondo integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  if not privado.puede_caja(p_restaurante) then raise exception 'Solo el dueño, caja o gerente abren la caja'; end if;
  if coalesce(p_fondo, 0) < 0 then raise exception 'El fondo no puede ser negativo'; end if;
  if exists (select 1 from public.turnos where restaurante_id = p_restaurante and cerrado_en is null) then raise exception 'Ya hay una caja abierta'; end if;
  insert into public.turnos (restaurante_id, abierto_por, fondo_centavos) values (p_restaurante, privado.empleado_actual(), coalesce(p_fondo, 0)) returning id into v;
  return v;
end;
$$;

-- Fondo de una caja que se abrió sola (al primer cobro) y todavía está en cero
create or replace function public.poner_fondo(p_turno uuid, p_fondo integer) returns void
language plpgsql security definer set search_path = '' as $$
declare t record;
begin
  select * into t from public.turnos where id = p_turno for update;
  if not found or not privado.puede_caja(t.restaurante_id) then raise exception 'Sin acceso a esta caja'; end if;
  if t.cerrado_en is not null then raise exception 'Esta caja ya se cerró'; end if;
  if coalesce(p_fondo, 0) < 0 then raise exception 'El fondo no puede ser negativo'; end if;
  update public.turnos set fondo_centavos = p_fondo where id = p_turno;
end;
$$;

-- Números del turno: ventas, formas de pago, propinas, efectivo esperado y lo más vendido
create or replace function public.resumen_turno(p_turno uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare t record; r jsonb;
begin
  select * into t from public.turnos where id = p_turno;
  if not found or not privado.puede_caja(t.restaurante_id) then raise exception 'Sin acceso a esta caja'; end if;
  select jsonb_build_object(
    'turno_id', t.id, 'abierto_en', t.abierto_en, 'cerrado_en', t.cerrado_en, 'fondo', t.fondo_centavos,
    'contado', t.efectivo_contado_centavos, 'notas', t.notas,
    'abierto_por', (select nombre from public.empleados where id = t.abierto_por),
    'cerrado_por', (select nombre from public.empleados where id = t.cerrado_por),
    'cobros', count(p.id),
    'cuentas', count(distinct p.orden_id),
    'ventas', coalesce(sum(p.monto_centavos), 0),
    'propinas', coalesce(sum(p.propina_centavos), 0),
    'efectivo', coalesce(sum(p.monto_centavos + p.propina_centavos) filter (where p.metodo = 'efectivo'), 0),
    'tarjeta', coalesce(sum(p.monto_centavos + p.propina_centavos) filter (where p.metodo = 'tarjeta'), 0),
    'transferencia', coalesce(sum(p.monto_centavos + p.propina_centavos) filter (where p.metodo = 'transferencia'), 0),
    'esperado', t.fondo_centavos + coalesce(sum(p.monto_centavos + p.propina_centavos) filter (where p.metodo = 'efectivo'), 0),
    'mas_vendido', coalesce((
      select jsonb_agg(x order by x.cantidad desc, x.nombre) from (
        select rr.nombre, sum(rr.cantidad)::int as cantidad, sum(rr.cantidad * rr.precio_centavos)::int as importe
          from public.renglones rr
         where rr.pagado and not rr.cancelado and rr.orden_id in (select orden_id from public.pagos where turno_id = t.id)
         group by rr.nombre order by sum(rr.cantidad) desc limit 5) x), '[]'::jsonb),
    'abiertas', (select count(*) from public.ordenes where restaurante_id = t.restaurante_id and estado = 'abierta'),
    'por_cobrar', (select coalesce(sum(rr.precio_centavos * rr.cantidad), 0) from public.renglones rr join public.ordenes oo on oo.id = rr.orden_id
                   where oo.restaurante_id = t.restaurante_id and oo.estado = 'abierta' and not rr.cancelado and not rr.pagado)
  ) into r
  from public.pagos p where p.turno_id = t.id;
  return r;
end;
$$;

create or replace function public.cerrar_turno(p_turno uuid, p_contado integer, p_notas text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t record;
begin
  select * into t from public.turnos where id = p_turno for update;
  if not found or not privado.puede_caja(t.restaurante_id) then raise exception 'Solo el dueño, caja o gerente hacen el corte'; end if;
  if t.cerrado_en is not null then raise exception 'Esta caja ya se cerró'; end if;
  if coalesce(p_contado, -1) < 0 then raise exception 'Escribe cuánto efectivo hay en caja'; end if;
  update public.turnos set cerrado_en = now(), cerrado_por = privado.empleado_actual(), efectivo_contado_centavos = p_contado,
    notas = left(coalesce(p_notas, ''), 500) where id = p_turno;
  return public.resumen_turno(p_turno);
end;
$$;

revoke execute on function public.cobrar(uuid, text, integer, integer, smallint[]), public.abrir_turno(uuid, integer), public.poner_fondo(uuid, integer),
  public.resumen_turno(uuid), public.cerrar_turno(uuid, integer, text) from public, anon;
grant execute on function public.cobrar(uuid, text, integer, integer, smallint[]), public.abrir_turno(uuid, integer), public.poner_fondo(uuid, integer),
  public.resumen_turno(uuid), public.cerrar_turno(uuid, integer, text) to authenticated;

-- Las cajas solo cambian por estas funciones: se quitan las escrituras directas de la app
revoke insert, update on public.turnos from authenticated;
revoke insert on public.pagos from authenticated;

-- Tiempo real: la pestaña Caja se actualiza con cada cobro
alter publication supabase_realtime add table public.pagos;

-- ── Candados en los renglones ──────────────────────────────────────────
-- El precio y el nombre salen siempre del menú; "pagado" solo lo pone cobrar()
create or replace function privado.precio_del_menu() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.producto_id is not null then
    select p.nombre, p.precio_centavos into new.nombre, new.precio_centavos
      from public.productos p where p.id = new.producto_id and p.restaurante_id = new.restaurante_id;
    if new.nombre is null then raise exception 'Ese platillo no está en el menú'; end if;
  end if;
  new.pagado := false;
  new.comanda_id := null;
  return new;
end;
$$;
create trigger renglones_precio_del_menu before insert on public.renglones
  for each row execute function privado.precio_del_menu();

revoke insert, update on public.renglones from authenticated;
grant insert (restaurante_id, orden_id, producto_id, nombre, precio_centavos, cantidad, comensal, nota) on public.renglones to authenticated;
grant update (cantidad, comensal, nota) on public.renglones to authenticated;
