-- Sin internet: la app genera el id de cada renglón para poder reintentar sin duplicar
-- (si el renglón ya llegó, el reintento choca con la llave y se toma como guardado).
grant insert (id) on public.renglones to authenticated;
