-- Acceso del equipo sin correo: código del restaurante + nombre + PIN.
-- Cada empleado obtiene su propia cuenta interna (la crea la función de borde "equipo")
-- y entra como miembro 'dispositivo': puede operar (órdenes, comandas) pero no administrar.

-- ── Código del restaurante ─────────────────────────────────────────────
create or replace function privado.nuevo_codigo() returns text
language plpgsql volatile set search_path = '' as $$
declare
  abc constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- sin 0/O ni 1/I para que no se confundan
  c text;
begin
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(abc, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % length(abc)), 1);
    end loop;
    exit when not exists (select 1 from public.restaurantes where codigo_equipo = c);
  end loop;
  return c;
end;
$$;

alter table public.restaurantes add column if not exists codigo_equipo text unique
  check (codigo_equipo ~ '^[A-HJ-NP-Z2-9]{6}$');
update public.restaurantes set codigo_equipo = privado.nuevo_codigo() where codigo_equipo is null;
alter table public.restaurantes alter column codigo_equipo set default privado.nuevo_codigo();
alter table public.restaurantes alter column codigo_equipo set not null;
grant select (codigo_equipo) on public.restaurantes to authenticated;

-- El dueño puede cambiar el código (por ejemplo, si se fue alguien que lo sabía)
create or replace function public.nuevo_codigo_equipo(p_restaurante uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare c text;
begin
  if not privado.es_dueno(p_restaurante) then raise exception 'Solo el dueño puede cambiar el código'; end if;
  c := privado.nuevo_codigo();
  update public.restaurantes set codigo_equipo = c where id = p_restaurante;
  return c;
end;
$$;
revoke execute on function public.nuevo_codigo_equipo(uuid) from public, anon;
grant execute on function public.nuevo_codigo_equipo(uuid) to authenticated;

-- ── Cuenta interna de cada empleado ────────────────────────────────────
alter table public.empleados add column if not exists usuario_id uuid unique references auth.users (id) on delete set null;

-- Si el dueño da de baja o borra a alguien, pierde el acceso en ese momento
create or replace function privado.quitar_acceso_empleado() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.usuario_id is not null and (tg_op = 'DELETE' or new.activo = false) then
    delete from public.miembros where user_id = old.usuario_id and restaurante_id = old.restaurante_id and rol = 'dispositivo';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger empleados_quitar_acceso after update of activo or delete on public.empleados
  for each row execute function privado.quitar_acceso_empleado();

-- Un empleado no puede crear restaurantes con su cuenta interna
create or replace function public.crear_restaurante(p_nombre text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión'; end if;
  if (select auth.jwt() -> 'app_metadata' ->> 'empleado_id') is not null then
    raise exception 'Las cuentas del equipo no pueden crear restaurantes';
  end if;
  if (select count(*) from public.miembros where user_id = v_uid and rol = 'dueno') >= 5 then
    raise exception 'Límite de 5 restaurantes por cuenta';
  end if;
  insert into public.restaurantes (nombre) values (btrim(p_nombre)) returning id into v_id;
  insert into public.miembros (restaurante_id, user_id, rol) values (v_id, v_uid, 'dueno');
  return v_id;
end;
$$;

-- ── Funciones que solo usa la función de borde (llave de servicio) ─────
-- Datos para pintar la pantalla de entrada del equipo de un restaurante
create or replace function public.equipo_por_codigo(p_codigo text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'restaurante', jsonb_build_object('nombre', r.nombre, 'logo_url', r.logo_url, 'eslogan', r.eslogan,
      'color_marca', r.color_marca, 'color_principal', r.color_principal, 'color_secundario', r.color_secundario,
      'color_fondo', r.color_fondo, 'tipografia', r.tipografia, 'fondo', r.fondo),
    'equipo', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre, 'rol', e.rol, 'foto_url', e.foto_url) order by e.nombre)
                        from public.empleados e where e.restaurante_id = r.id and e.activo), '[]'::jsonb))
  from public.restaurantes r where r.codigo_equipo = upper(p_codigo);
$$;

-- Revisa el PIN con el mismo bloqueo de siempre (5 intentos fallidos = 5 minutos). No lanza error en un PIN
-- equivocado para que el contador de intentos sí se guarde.
create or replace function public.entrar_con_pin(p_codigo text, p_empleado uuid, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e record;
begin
  select em.* into e from public.empleados em join public.restaurantes r on r.id = em.restaurante_id
   where em.id = p_empleado and r.codigo_equipo = upper(p_codigo) and em.activo for update of em;
  if not found then return jsonb_build_object('ok', false, 'error', 'Esa persona ya no está en el equipo'); end if;
  if e.bloqueado_hasta is not null and e.bloqueado_hasta > now() then
    return jsonb_build_object('ok', false, 'error', 'Demasiados intentos. Espera unos minutos');
  end if;
  if e.pin_hash = extensions.crypt(coalesce(p_pin, ''), e.pin_hash) then
    update public.empleados set intentos_fallidos = 0, bloqueado_hasta = null where id = e.id;
    return jsonb_build_object('ok', true, 'empleado_id', e.id, 'restaurante_id', e.restaurante_id, 'rol', e.rol, 'usuario_id', e.usuario_id);
  end if;
  update public.empleados set
    intentos_fallidos = case when e.intentos_fallidos + 1 >= 5 then 0 else e.intentos_fallidos + 1 end,
    bloqueado_hasta = case when e.intentos_fallidos + 1 >= 5 then now() + interval '5 minutes' else null end
  where id = e.id;
  return jsonb_build_object('ok', false, 'error', case when e.intentos_fallidos + 1 >= 5 then 'Demasiados intentos. Espera unos minutos' else 'PIN incorrecto' end);
end;
$$;

-- Liga la cuenta interna con el empleado y la hace miembro del restaurante
create or replace function public.vincular_cuenta_empleado(p_empleado uuid, p_usuario uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare e record;
begin
  select * into e from public.empleados where id = p_empleado and activo;
  if not found then raise exception 'Empleado no encontrado'; end if;
  update public.empleados set usuario_id = p_usuario where id = p_empleado and usuario_id is distinct from p_usuario;
  insert into public.miembros (restaurante_id, user_id, rol) values (e.restaurante_id, p_usuario, 'dispositivo')
  on conflict (restaurante_id, user_id) do nothing;
end;
$$;

revoke execute on function public.equipo_por_codigo(text), public.entrar_con_pin(text, uuid, text), public.vincular_cuenta_empleado(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.equipo_por_codigo(text), public.entrar_con_pin(text, uuid, text), public.vincular_cuenta_empleado(uuid, uuid)
  to service_role;

-- ── El gerente también arma el menú ────────────────────────────────────
create or replace function privado.es_gerente(r uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.empleados e join public.miembros m on m.user_id = e.usuario_id and m.restaurante_id = e.restaurante_id
                 where e.restaurante_id = r and e.usuario_id = (select auth.uid()) and e.rol = 'gerente' and e.activo);
$$;
revoke execute on function privado.es_gerente(uuid) from public, anon;
grant execute on function privado.es_gerente(uuid) to authenticated;

create policy "gerente escribe categorias" on public.categorias for insert to authenticated with check (privado.es_gerente(restaurante_id));
create policy "gerente edita categorias" on public.categorias for update to authenticated using (privado.es_gerente(restaurante_id)) with check (privado.es_gerente(restaurante_id));
create policy "gerente borra categorias" on public.categorias for delete to authenticated using (privado.es_gerente(restaurante_id));
create policy "gerente escribe productos" on public.productos for insert to authenticated with check (privado.es_gerente(restaurante_id));
create policy "gerente edita productos" on public.productos for update to authenticated using (privado.es_gerente(restaurante_id)) with check (privado.es_gerente(restaurante_id));
create policy "gerente borra productos" on public.productos for delete to authenticated using (privado.es_gerente(restaurante_id));
create policy "gerente sube fotos de platillos" on storage.objects for insert to authenticated
  with check (bucket_id = 'imagenes' and (storage.foldername(name))[2] = 'productos' and privado.es_gerente(privado.carpeta_restaurante(name)));
create policy "gerente borra fotos de platillos" on storage.objects for delete to authenticated
  using (bucket_id = 'imagenes' and (storage.foldername(name))[2] = 'productos' and privado.es_gerente(privado.carpeta_restaurante(name)));
