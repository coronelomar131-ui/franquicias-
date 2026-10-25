-- Comandero · esquema inicial
-- Cada fila lleva restaurante_id y RLS limita el acceso a los miembros de ese restaurante.
-- Dinero en centavos (enteros). Horas en timestamptz.

-- ── Restaurantes y miembros ────────────────────────────────────────────
create table public.restaurantes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 80),
  zona_horaria text not null default 'America/Mexico_City',
  ultimo_folio integer not null default 0,
  creado_en timestamptz not null default now()
);

-- Cuentas con correo (dueño) y, más adelante, dispositivos vinculados
create table public.miembros (
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rol text not null check (rol in ('dueno', 'dispositivo')),
  creado_en timestamptz not null default now(),
  primary key (restaurante_id, user_id)
);
create index miembros_user_idx on public.miembros (user_id);

-- Funciones de permiso: security definer para no recursar en RLS
create function public.es_miembro(r uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.miembros m where m.restaurante_id = r and m.user_id = (select auth.uid()));
$$;
create function public.es_dueno(r uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.miembros m where m.restaurante_id = r and m.user_id = (select auth.uid()) and m.rol = 'dueno');
$$;

-- ── Empleados (entran con PIN en el dispositivo) ───────────────────────
create table public.empleados (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 60),
  rol text not null check (rol in ('gerente', 'mesero', 'cocina', 'caja')),
  pin_hash text not null,
  intentos_fallidos smallint not null default 0,
  bloqueado_hasta timestamptz,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (id, restaurante_id)
);
create index empleados_rest_idx on public.empleados (restaurante_id);

-- ── Menú y mesas ───────────────────────────────────────────────────────
create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 40),
  orden integer not null default 0,
  activa boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (id, restaurante_id)
);
create index categorias_rest_idx on public.categorias (restaurante_id);

create table public.productos (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  categoria_id uuid,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 80),
  descripcion text not null default '' check (char_length(descripcion) <= 160),
  precio_centavos integer not null check (precio_centavos between 0 and 10000000),
  activo boolean not null default true,
  orden integer not null default 0,
  creado_en timestamptz not null default now(),
  unique (id, restaurante_id),
  foreign key (categoria_id, restaurante_id) references public.categorias (id, restaurante_id) on delete set null (categoria_id)
);
create index productos_rest_idx on public.productos (restaurante_id);
create index productos_cat_idx on public.productos (categoria_id);

create table public.mesas (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 20),
  forma text not null default 'cuadrada' check (forma in ('cuadrada', 'redonda', 'larga')),
  lugares smallint not null default 4 check (lugares between 1 and 20),
  orden integer not null default 0,
  activa boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (id, restaurante_id)
);
create index mesas_rest_idx on public.mesas (restaurante_id);

-- ── Operación: turnos de caja, órdenes, renglones, comandas y pagos ───
create table public.turnos (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  abierto_en timestamptz not null default now(),
  abierto_por uuid references public.empleados (id) on delete set null,
  fondo_centavos integer not null default 0 check (fondo_centavos >= 0),
  cerrado_en timestamptz,
  cerrado_por uuid references public.empleados (id) on delete set null,
  efectivo_contado_centavos integer check (efectivo_contado_centavos >= 0),
  notas text not null default '' check (char_length(notas) <= 500),
  unique (id, restaurante_id)
);
create index turnos_rest_idx on public.turnos (restaurante_id);
create unique index turnos_uno_abierto on public.turnos (restaurante_id) where cerrado_en is null;

create table public.ordenes (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  mesa_id uuid,
  folio integer not null default 0,
  comensales smallint not null default 1 check (comensales between 1 and 30),
  estado text not null default 'abierta' check (estado in ('abierta', 'pagada', 'cancelada')),
  abierta_por uuid references public.empleados (id) on delete set null,
  abierta_en timestamptz not null default now(),
  cerrada_en timestamptz,
  nota text not null default '' check (char_length(nota) <= 200),
  unique (id, restaurante_id),
  foreign key (mesa_id, restaurante_id) references public.mesas (id, restaurante_id) on delete set null (mesa_id)
);
create index ordenes_rest_idx on public.ordenes (restaurante_id, abierta_en desc);
create unique index ordenes_una_abierta_por_mesa on public.ordenes (mesa_id) where estado = 'abierta';

create table public.comandas (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  orden_id uuid not null,
  ronda smallint not null check (ronda >= 1),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'lista')),
  enviada_en timestamptz not null default now(),
  enviada_por uuid references public.empleados (id) on delete set null,
  lista_en timestamptz,
  unique (id, restaurante_id),
  foreign key (orden_id, restaurante_id) references public.ordenes (id, restaurante_id) on delete cascade
);
create index comandas_rest_idx on public.comandas (restaurante_id, estado);
create index comandas_orden_idx on public.comandas (orden_id);

create table public.renglones (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  orden_id uuid not null,
  producto_id uuid,
  nombre text not null check (char_length(nombre) between 1 and 80),
  precio_centavos integer not null check (precio_centavos between 0 and 10000000),
  cantidad smallint not null check (cantidad between 1 and 99),
  comensal smallint not null default 1 check (comensal between 1 and 30),
  nota text not null default '' check (char_length(nota) <= 120),
  comanda_id uuid,
  pagado boolean not null default false,
  cancelado boolean not null default false,
  cancelado_motivo text check (char_length(cancelado_motivo) <= 120),
  cancelado_por uuid references public.empleados (id) on delete set null,
  creado_en timestamptz not null default now(),
  foreign key (orden_id, restaurante_id) references public.ordenes (id, restaurante_id) on delete cascade,
  foreign key (producto_id, restaurante_id) references public.productos (id, restaurante_id) on delete set null (producto_id),
  foreign key (comanda_id, restaurante_id) references public.comandas (id, restaurante_id) on delete set null (comanda_id)
);
create index renglones_orden_idx on public.renglones (orden_id);
create index renglones_rest_idx on public.renglones (restaurante_id);
create index renglones_comanda_idx on public.renglones (comanda_id);
create index renglones_producto_idx on public.renglones (producto_id);

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  orden_id uuid not null,
  turno_id uuid,
  monto_centavos integer not null check (monto_centavos > 0),
  propina_centavos integer not null default 0 check (propina_centavos >= 0),
  metodo text not null check (metodo in ('efectivo', 'tarjeta', 'transferencia')),
  recibido_centavos integer check (recibido_centavos >= 0),
  cobrado_por uuid references public.empleados (id) on delete set null,
  creado_en timestamptz not null default now(),
  foreign key (orden_id, restaurante_id) references public.ordenes (id, restaurante_id) on delete cascade,
  foreign key (turno_id, restaurante_id) references public.turnos (id, restaurante_id) on delete set null (turno_id)
);
create index pagos_rest_idx on public.pagos (restaurante_id, creado_en desc);
create index pagos_orden_idx on public.pagos (orden_id);
create index pagos_turno_idx on public.pagos (turno_id);

-- Índices para las llaves foráneas a empleados
create index turnos_abierto_por_idx on public.turnos (abierto_por);
create index turnos_cerrado_por_idx on public.turnos (cerrado_por);
create index ordenes_abierta_por_idx on public.ordenes (abierta_por);
create index ordenes_mesa_idx on public.ordenes (mesa_id);
create index comandas_enviada_por_idx on public.comandas (enviada_por);
create index renglones_cancelado_por_idx on public.renglones (cancelado_por);
create index pagos_cobrado_por_idx on public.pagos (cobrado_por);

-- Folio consecutivo por restaurante
create function public.asignar_folio() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.restaurantes set ultimo_folio = ultimo_folio + 1 where id = new.restaurante_id returning ultimo_folio into new.folio;
  return new;
end;
$$;
create trigger ordenes_folio before insert on public.ordenes for each row execute function public.asignar_folio();

-- ── RLS ────────────────────────────────────────────────────────────────
alter table public.restaurantes enable row level security;
alter table public.miembros enable row level security;
alter table public.empleados enable row level security;
alter table public.categorias enable row level security;
alter table public.productos enable row level security;
alter table public.mesas enable row level security;
alter table public.turnos enable row level security;
alter table public.ordenes enable row level security;
alter table public.comandas enable row level security;
alter table public.renglones enable row level security;
alter table public.pagos enable row level security;

-- Nadie anónimo toca nada
revoke all on all tables in schema public from anon;

create policy "miembros ven su restaurante" on public.restaurantes for select to authenticated using (public.es_miembro(id));
create policy "dueño edita su restaurante" on public.restaurantes for update to authenticated using (public.es_dueno(id)) with check (public.es_dueno(id));

create policy "cada quien ve sus membresías" on public.miembros for select to authenticated
  using (user_id = (select auth.uid()) or public.es_dueno(restaurante_id));

-- Empleados: se leen sin el hash; se escriben solo con funciones
create policy "miembros ven empleados" on public.empleados for select to authenticated using (public.es_miembro(restaurante_id));
revoke all on public.empleados from authenticated;
grant select (id, restaurante_id, nombre, rol, activo, creado_en) on public.empleados to authenticated;
-- El folio solo lo mueve el trigger
revoke insert, update, delete on public.restaurantes from authenticated;
grant update (nombre, zona_horaria) on public.restaurantes to authenticated;
revoke insert, update, delete on public.miembros from authenticated;

-- Menú y mesas: todos los miembros leen, el dueño escribe
create policy "miembros leen categorias" on public.categorias for select to authenticated using (public.es_miembro(restaurante_id));
create policy "dueño escribe categorias" on public.categorias for insert to authenticated with check (public.es_dueno(restaurante_id));
create policy "dueño edita categorias" on public.categorias for update to authenticated using (public.es_dueno(restaurante_id)) with check (public.es_dueno(restaurante_id));
create policy "dueño borra categorias" on public.categorias for delete to authenticated using (public.es_dueno(restaurante_id));

create policy "miembros leen productos" on public.productos for select to authenticated using (public.es_miembro(restaurante_id));
create policy "dueño escribe productos" on public.productos for insert to authenticated with check (public.es_dueno(restaurante_id));
create policy "dueño edita productos" on public.productos for update to authenticated using (public.es_dueno(restaurante_id)) with check (public.es_dueno(restaurante_id));
create policy "dueño borra productos" on public.productos for delete to authenticated using (public.es_dueno(restaurante_id));

create policy "miembros leen mesas" on public.mesas for select to authenticated using (public.es_miembro(restaurante_id));
create policy "dueño escribe mesas" on public.mesas for insert to authenticated with check (public.es_dueno(restaurante_id));
create policy "dueño edita mesas" on public.mesas for update to authenticated using (public.es_dueno(restaurante_id)) with check (public.es_dueno(restaurante_id));
create policy "dueño borra mesas" on public.mesas for delete to authenticated using (public.es_dueno(restaurante_id));

-- Operación: los miembros leen y registran; no se borra historial
create policy "miembros leen turnos" on public.turnos for select to authenticated using (public.es_miembro(restaurante_id));
create policy "miembros abren turnos" on public.turnos for insert to authenticated with check (public.es_miembro(restaurante_id));
create policy "miembros cierran turnos" on public.turnos for update to authenticated using (public.es_miembro(restaurante_id)) with check (public.es_miembro(restaurante_id));

create policy "miembros leen ordenes" on public.ordenes for select to authenticated using (public.es_miembro(restaurante_id));
create policy "miembros abren ordenes" on public.ordenes for insert to authenticated with check (public.es_miembro(restaurante_id));
create policy "miembros editan ordenes" on public.ordenes for update to authenticated using (public.es_miembro(restaurante_id)) with check (public.es_miembro(restaurante_id));

create policy "miembros leen comandas" on public.comandas for select to authenticated using (public.es_miembro(restaurante_id));
create policy "miembros envian comandas" on public.comandas for insert to authenticated with check (public.es_miembro(restaurante_id));
create policy "miembros marcan comandas" on public.comandas for update to authenticated using (public.es_miembro(restaurante_id)) with check (public.es_miembro(restaurante_id));

create policy "miembros leen renglones" on public.renglones for select to authenticated using (public.es_miembro(restaurante_id));
create policy "miembros agregan renglones" on public.renglones for insert to authenticated with check (public.es_miembro(restaurante_id));
create policy "miembros editan renglones" on public.renglones for update to authenticated using (public.es_miembro(restaurante_id)) with check (public.es_miembro(restaurante_id));
create policy "miembros quitan renglones sin enviar" on public.renglones for delete to authenticated using (public.es_miembro(restaurante_id) and comanda_id is null and not pagado);

create policy "miembros leen pagos" on public.pagos for select to authenticated using (public.es_miembro(restaurante_id));
create policy "miembros registran pagos" on public.pagos for insert to authenticated with check (public.es_miembro(restaurante_id));

-- ── Funciones ──────────────────────────────────────────────────────────
-- Alta de restaurante: crea el restaurante y deja al usuario como dueño
create function public.crear_restaurante(p_nombre text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión'; end if;
  if (select count(*) from public.miembros where user_id = v_uid and rol = 'dueno') >= 5 then
    raise exception 'Límite de 5 restaurantes por cuenta';
  end if;
  insert into public.restaurantes (nombre) values (btrim(p_nombre)) returning id into v_id;
  insert into public.miembros (restaurante_id, user_id, rol) values (v_id, v_uid, 'dueno');
  return v_id;
end;
$$;

-- Alta o edición de empleado. El PIN (4 a 6 dígitos) se guarda con hash; si p_pin es nulo se conserva.
create function public.guardar_empleado(p_restaurante uuid, p_id uuid, p_nombre text, p_rol text, p_pin text, p_activo boolean default true) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.es_dueno(p_restaurante) then raise exception 'Solo el dueño puede administrar empleados'; end if;
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

-- Validar PIN. Tras 5 intentos fallidos el empleado queda bloqueado 5 minutos.
create function public.validar_pin(p_restaurante uuid, p_empleado uuid, p_pin text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare e record;
begin
  if not public.es_miembro(p_restaurante) then raise exception 'Sin acceso a este restaurante'; end if;
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

revoke execute on function public.es_miembro(uuid), public.es_dueno(uuid), public.crear_restaurante(text),
  public.guardar_empleado(uuid, uuid, text, text, text, boolean), public.validar_pin(uuid, uuid, text), public.asignar_folio()
  from public, anon;
grant execute on function public.es_miembro(uuid), public.es_dueno(uuid), public.crear_restaurante(text),
  public.guardar_empleado(uuid, uuid, text, text, text, boolean), public.validar_pin(uuid, uuid, text)
  to authenticated;

-- Tiempo real para cocina y salón
alter publication supabase_realtime add table public.ordenes, public.renglones, public.comandas;
