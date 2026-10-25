import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { conTeclado } from "../lib/dispositivo";
import { useSesion } from "../estado/sesion";
import { supabase } from "../lib/supabase";
import type { Categoria, Producto } from "../lib/tipos";
import { aCentavos, mensajeError, pesos } from "../lib/formato";
import { borrarImagen, subirImagen } from "../lib/imagen";
import { useAviso } from "../componentes/Aviso";
import { DobleToque } from "../componentes/Controles";
import { Icono } from "../componentes/Icono";

type Edicion = { tipo: "producto"; id: string | "nuevo"; categoria: string | null } | { tipo: "categoria"; id: string | "nueva" } | null;

export function Menu({ rid }: { rid: string }) {
  const { actual } = useSesion();
  const avisar = useAviso();
  const [cats, setCats] = useState<Categoria[] | null>(null);
  const [prods, setProds] = useState<Producto[]>([]);
  const [edicion, setEdicion] = useState<Edicion>(null);

  async function cargar() {
    const [c, p] = await Promise.all([
      supabase.from("categorias").select("*").eq("restaurante_id", rid).order("orden").order("creado_en"),
      supabase.from("productos").select("*").eq("restaurante_id", rid).order("orden").order("creado_en"),
    ]);
    if (c.error) throw c.error;
    if (p.error) throw p.error;
    setCats(c.data ?? []); setProds(p.data ?? []);
  }
  useEffect(() => { cargar().catch((e) => { setCats([]); avisar(mensajeError(e), "error"); }); }, [rid]); // eslint-disable-line react-hooks/exhaustive-deps

  async function hacer(fn: () => PromiseLike<{ error: unknown }>, ok?: string) {
    const { error } = await fn();
    if (error) { avisar(mensajeError(error), "error"); return false; }
    await cargar().catch(() => {});
    if (ok) avisar(ok);
    return true;
  }

  async function mover(lista: { id: string; orden: number }[], tabla: "categorias" | "productos", id: string, dir: -1 | 1) {
    const i = lista.findIndex((x) => x.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= lista.length) return;
    // Se reescribe el orden de toda la lista para que no queden empates
    const nueva = [...lista]; [nueva[i], nueva[j]] = [nueva[j], nueva[i]];
    for (const [k, x] of nueva.entries()) {
      if (x.orden === k) continue;
      const { error } = await supabase.from(tabla).update({ orden: k }).eq("id", x.id);
      if (error) { avisar(mensajeError(error), "error"); break; }
    }
    await cargar().catch(() => {});
  }

  if (cats === null) return <div className="menu-ed"><h1 className="titulo" tabIndex={-1}>Menú</h1><p className="sub">Cargando…</p></div>;

  const secciones: { cat: Categoria | null; items: Producto[] }[] = [
    ...cats.map((c) => ({ cat: c, items: prods.filter((p) => p.categoria_id === c.id) })),
    ...(prods.some((p) => !p.categoria_id) ? [{ cat: null, items: prods.filter((p) => !p.categoria_id) }] : []),
  ];

  return (
    <div className="menu-ed">
      <div className="encabezado">
        <h1 className="titulo" tabIndex={-1}>Menú</h1>
        <p className="sub"><b>{prods.length}</b> {prods.length === 1 ? "platillo" : "platillos"} en <b>{cats.length}</b> {cats.length === 1 ? "categoría" : "categorías"}</p>
      </div>

      {cats.length > 0 && (
        <nav className="indice" aria-label="Ir a categoría">
          {cats.map((c) => <a key={c.id} href={"#cat-" + c.id} onClick={(e) => { e.preventDefault(); document.getElementById("cat-" + c.id)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); }}>{c.nombre}</a>)}
        </nav>
      )}

      {secciones.length === 0 && edicion?.tipo !== "categoria" && (
        <div className="vacio-grande">
          <strong>Tu carta está en blanco</strong>
          <p>Empieza por las categorías como las tienes en tu menú impreso: tacos, platos, bebidas… Luego agrega los platillos con su precio.</p>
        </div>
      )}

      <div className="carta">
        {actual && secciones.length > 0 && (
          <div className="membrete" aria-hidden="true">
            {actual.logo_url && <img src={actual.logo_url} alt="" />}
            <strong translate="no">{actual.nombre}</strong>
            {actual.eslogan && <span>{actual.eslogan}</span>}
          </div>
        )}
        {secciones.map(({ cat, items }, si) => {
          const editandoCat = cat && edicion?.tipo === "categoria" && edicion.id === cat.id;
          return (
            <section key={cat?.id ?? "sin"} id={cat ? "cat-" + cat.id : undefined} className={"seccion" + (cat && !cat.activa ? " apagada" : "")} aria-labelledby={"t-" + (cat?.id ?? "sin")}>
              {editandoCat ? (
                <FormaCategoria inicial={cat.nombre} onCancelar={() => setEdicion(null)} onGuardar={async (nombre) => {
                  if (await hacer(() => supabase.from("categorias").update({ nombre }).eq("id", cat.id))) setEdicion(null);
                }} extra={
                  <>
                    <button type="button" className="texto" onClick={() => hacer(() => supabase.from("categorias").update({ activa: !cat.activa }).eq("id", cat.id), cat.activa ? "Categoría oculta para los meseros" : "Categoría visible")}>{cat.activa ? "Ocultar" : "Mostrar"}</button>
                    <DobleToque texto="Borrar" pregunta={items.length ? "Sus platillos quedan sin categoría. ¿Borrar?" : "¿Borrar? Toca otra vez"} onConfirmar={async () => {
                      if (await hacer(() => supabase.from("categorias").delete().eq("id", cat.id), "Categoría borrada")) setEdicion(null);
                    }} />
                  </>
                } />
              ) : (
                <div className="seccion-cab">
                  <h2 id={"t-" + (cat?.id ?? "sin")}>{cat ? cat.nombre : "Sin categoría"}</h2>
                  {cat && !cat.activa && <span className="sello-mini">Oculta</span>}
                  {cat && (
                    <div className="seccion-acc">
                      <button className="icono-b" type="button" onClick={() => mover(cats, "categorias", cat.id, -1)} disabled={si === 0} aria-label={"Subir " + cat.nombre}><Icono n="arriba" /></button>
                      <button className="icono-b" type="button" onClick={() => mover(cats, "categorias", cat.id, 1)} disabled={si >= cats.length - 1} aria-label={"Bajar " + cat.nombre}><Icono n="abajo" /></button>
                      <button className="icono-b" type="button" onClick={() => setEdicion({ tipo: "categoria", id: cat.id })} aria-label={"Editar " + cat.nombre}><Icono n="lapiz" /></button>
                    </div>
                  )}
                </div>
              )}

              <ul className="platos">
                {items.map((p, pi) => (
                  <li key={p.id} className={!p.activo ? "apagado" : undefined}>
                    {edicion?.tipo === "producto" && edicion.id === p.id ? (
                      <FormaProducto rid={rid} cats={cats} inicial={p} onCancelar={() => setEdicion(null)}
                        onGuardar={async (v) => { if (await hacer(() => supabase.from("productos").update(v).eq("id", p.id), "Platillo guardado")) setEdicion(null); }}
                        onBorrar={async () => { if (await hacer(() => supabase.from("productos").delete().eq("id", p.id), "Platillo borrado")) { borrarImagen(p.foto_url).catch(() => {}); setEdicion(null); } }}
                        onMover={(dir) => mover(items, "productos", p.id, dir)} puedeSubir={pi > 0} puedeBajar={pi < items.length - 1} />
                    ) : (
                      <button type="button" className={"plato" + (p.foto_url ? " con-foto" : "")} onClick={() => setEdicion({ tipo: "producto", id: p.id, categoria: p.categoria_id })} aria-label={`Editar ${p.nombre}, ${pesos(p.precio_centavos)}`}>
                        {p.foto_url && <img className="plato-foto" src={p.foto_url} alt="" loading="lazy" width={56} height={56} />}
                        <span className="plato-nom">{p.nombre}{!p.activo && <span className="sello-mini">Agotado</span>}</span>
                        <span className="puntos" aria-hidden="true" />
                        <span className="plato-precio">{pesos(p.precio_centavos)}</span>
                        {p.descripcion && <span className="plato-desc">{p.descripcion}</span>}
                      </button>
                    )}
                  </li>
                ))}
                <li>
                  {edicion?.tipo === "producto" && edicion.id === "nuevo" && edicion.categoria === (cat?.id ?? null) ? (
                    <FormaProducto rid={rid} cats={cats} inicial={{ categoria_id: cat?.id ?? null }} onCancelar={() => setEdicion(null)}
                      onGuardar={async (v) => {
                        const orden = items.length ? Math.max(...items.map((x) => x.orden)) + 1 : 0;
                        if (await hacer(() => supabase.from("productos").insert({ ...v, restaurante_id: rid, orden }), "Platillo agregado")) setEdicion({ tipo: "producto", id: "nuevo", categoria: v.categoria_id });
                      }} />
                  ) : (
                    <button type="button" className="agregar-fila" onClick={() => setEdicion({ tipo: "producto", id: "nuevo", categoria: cat?.id ?? null })}>
                      <Icono n="mas" /> Agregar platillo{cat ? " a " + cat.nombre : ""}
                    </button>
                  )}
                </li>
              </ul>
            </section>
          );
        })}

        {edicion?.tipo === "categoria" && edicion.id === "nueva" ? (
          <section className="seccion">
            <FormaCategoria inicial="" onCancelar={() => setEdicion(null)} onGuardar={async (nombre) => {
              const orden = cats.length ? Math.max(...cats.map((c) => c.orden)) + 1 : 0;
              if (await hacer(() => supabase.from("categorias").insert({ restaurante_id: rid, nombre, orden }), "Categoría agregada")) setEdicion(null);
            }} />
          </section>
        ) : (
          <button type="button" className="secundario agregar-cat" onClick={() => setEdicion({ tipo: "categoria", id: "nueva" })}><Icono n="mas" /> Nueva categoría</button>
        )}
      </div>
    </div>
  );
}

function FormaCategoria({ inicial, onGuardar, onCancelar, extra }: { inicial: string; onGuardar: (nombre: string) => Promise<void>; onCancelar: () => void; extra?: ReactNode }) {
  const [nombre, setNombre] = useState(inicial);
  const [enviando, setEnviando] = useState(false);
  async function enviar(e: FormEvent) { e.preventDefault(); if (!nombre.trim()) return; setEnviando(true); await onGuardar(nombre.trim()); setEnviando(false); }
  return (
    <form className="editor entra" onSubmit={enviar}>
      <label className="campo"><span>Nombre de la categoría</span>
        <input className="entrada" autoFocus={conTeclado} maxLength={40} required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tacos, Bebidas, Postres…" autoComplete="off" name="categoria" />
      </label>
      <div className="editor-acc">
        <button className="primario" type="submit" disabled={enviando || !nombre.trim()}>{enviando ? "Guardando…" : "Guardar"}</button>
        <button className="secundario" type="button" onClick={onCancelar}>Cancelar</button>
        {extra && <span className="editor-extra">{extra}</span>}
      </div>
    </form>
  );
}

type ValoresProducto = { nombre: string; descripcion: string; precio_centavos: number; activo: boolean; categoria_id: string | null; foto_url: string | null };
function FormaProducto({ rid, cats, inicial, onGuardar, onCancelar, onBorrar, onMover, puedeSubir, puedeBajar }: {
  rid: string; cats: Categoria[]; inicial: Partial<Producto>; onGuardar: (v: ValoresProducto) => Promise<void>; onCancelar: () => void;
  onBorrar?: () => Promise<void>; onMover?: (dir: -1 | 1) => void; puedeSubir?: boolean; puedeBajar?: boolean;
}) {
  const [nombre, setNombre] = useState(inicial.nombre ?? "");
  const [desc, setDesc] = useState(inicial.descripcion ?? "");
  const [precio, setPrecio] = useState(inicial.precio_centavos !== undefined ? String(inicial.precio_centavos / 100) : "");
  const [activo, setActivo] = useState(inicial.activo ?? true);
  const [cat, setCat] = useState<string>(inicial.categoria_id ?? "");
  const [foto, setFoto] = useState<string | null>(inicial.foto_url ?? null);
  const [subiendo, setSubiendo] = useState(false);
  const [errorFoto, setErrorFoto] = useState("");
  const archivo = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const centavos = aCentavos(precio);
  async function elegirFoto(f: File | undefined) {
    if (!f) return;
    setSubiendo(true); setErrorFoto("");
    try {
      const url = await subirImagen(rid, "productos", f);
      if (foto && foto !== inicial.foto_url) borrarImagen(foto).catch(() => {});
      setFoto(url);
    } catch (e) { setErrorFoto(mensajeError(e)); }
    finally { setSubiendo(false); if (archivo.current) archivo.current.value = ""; }
  }
  const valido = nombre.trim().length > 0 && centavos !== null && centavos <= 10000000;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!valido) return;
    setEnviando(true);
    await onGuardar({ nombre: nombre.trim(), descripcion: desc.trim(), precio_centavos: centavos!, activo, categoria_id: cat || null, foto_url: foto });
    if (inicial.foto_url && inicial.foto_url !== foto) borrarImagen(inicial.foto_url).catch(() => {});
    setEnviando(false);
    if (!inicial.id) { setNombre(""); setDesc(""); setPrecio(""); setFoto(null); }
  }
  return (
    <form className="editor entra" onSubmit={enviar}>
      <div className="foto-fila">
        <button type="button" className={"foto-caja" + (subiendo ? " subiendo" : "")} onClick={() => archivo.current?.click()} disabled={subiendo} aria-label={foto ? "Cambiar foto del platillo" : "Agregar foto del platillo"}>
          {foto ? <img src={foto} alt="Foto del platillo" /> : <span className="logo-vacio"><Icono n="foto" tam={26} /><small>{subiendo ? "Subiendo…" : "Foto"}</small></span>}
        </button>
        <div className="pila-corta">
          <span className="nota">{subiendo ? "Subiendo foto…" : foto ? "Así la ven los meseros al tomar el pedido." : "Una foto ayuda a los meseros a no equivocarse."}</span>
          {foto && !subiendo && <button type="button" className="texto peligro" onClick={() => setFoto(null)}>Quitar foto</button>}
          {errorFoto && <p className="error">{errorFoto}</p>}
        </div>
        <input ref={archivo} type="file" accept="image/*" hidden onChange={(e) => elegirFoto(e.target.files?.[0])} />
      </div>
      <div className="editor-fila">
        <label className="campo crece"><span>Platillo</span>
          <input className="entrada" autoFocus={conTeclado} maxLength={80} required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tacos al pastor" autoComplete="off" name="platillo" />
        </label>
        <label className="campo precio"><span>Precio</span>
          <input className="entrada num" inputMode="decimal" required value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="95" autoComplete="off" name="precio" />
        </label>
      </div>
      <label className="campo"><span>Descripción (opcional)</span>
        <input className="entrada" maxLength={160} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Orden de 4, con piña…" autoComplete="off" name="descripcion" />
      </label>
      <div className="editor-fila">
        <label className="campo crece"><span>Categoría</span>
          <select className="entrada" value={cat} onChange={(e) => setCat(e.target.value)} name="categoria">
            <option value="">Sin categoría</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <label className="interruptor">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          <span className="riel" aria-hidden="true"><i /></span>
          <span>{activo ? "Disponible" : "Agotado"}</span>
        </label>
      </div>
      {precio && centavos === null && <p className="error">Escribe el precio con números, por ejemplo 95 o 120.50.</p>}
      <div className="editor-acc">
        <button className="primario" type="submit" disabled={enviando || subiendo || !valido}>{enviando ? "Guardando…" : inicial.id ? "Guardar" : "Agregar"}</button>
        <button className="secundario" type="button" onClick={onCancelar}>{inicial.id ? "Cancelar" : "Listo"}</button>
        {onMover && <>
          <button className="icono-b" type="button" disabled={!puedeSubir} onClick={() => onMover(-1)} aria-label="Subir platillo"><Icono n="arriba" /></button>
          <button className="icono-b" type="button" disabled={!puedeBajar} onClick={() => onMover(1)} aria-label="Bajar platillo"><Icono n="abajo" /></button>
        </>}
        {onBorrar && <span className="editor-extra"><DobleToque texto="Borrar" pregunta="¿Borrar? Toca otra vez" onConfirmar={onBorrar} /></span>}
      </div>
    </form>
  );
}
