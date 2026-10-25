import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { mensajeError } from "../lib/formato";
import { useSesion } from "../estado/sesion";
import { Segmento } from "../componentes/Controles";

const EJEMPLO = {
  categorias: ["Tacos", "Platos", "Bebidas", "Postres"],
  productos: [
    ["Tacos", "Tacos al pastor", "Orden de 4, con piña", 9500], ["Tacos", "Tacos de suadero", "Orden de 4", 9500], ["Tacos", "Gringa de pastor", "Harina, con queso", 7500],
    ["Platos", "Enchiladas verdes", "Pollo, crema y queso", 12500], ["Platos", "Chilaquiles rojos", "Con pollo o huevo", 11500], ["Platos", "Pozole rojo", "Grande, con tostadas", 14000],
    ["Bebidas", "Agua de horchata", "Jarra de litro", 4500], ["Bebidas", "Refresco", "Vidrio 355 ml", 3500], ["Bebidas", "Café de olla", "Taza", 3200],
    ["Postres", "Flan napolitano", "Rebanada", 4800],
  ] as [string, string, string, number][],
  mesas: [["1", "cuadrada", 4], ["2", "redonda", 2], ["3", "larga", 6], ["4", "redonda", 4], ["5", "cuadrada", 4], ["6", "redonda", 2]] as [string, "cuadrada" | "redonda" | "larga", number][],
};

async function sembrarEjemplo(rid: string) {
  const { data: cats, error: e1 } = await supabase.from("categorias")
    .insert(EJEMPLO.categorias.map((nombre, orden) => ({ restaurante_id: rid, nombre, orden }))).select("id, nombre");
  if (e1) throw e1;
  const idDe = new Map(cats.map((c) => [c.nombre, c.id]));
  const { error: e2 } = await supabase.from("productos").insert(EJEMPLO.productos.map(([cat, nombre, descripcion, precio_centavos], orden) =>
    ({ restaurante_id: rid, categoria_id: idDe.get(cat), nombre, descripcion, precio_centavos, orden })));
  if (e2) throw e2;
  const { error: e3 } = await supabase.from("mesas").insert(EJEMPLO.mesas.map(([nombre, forma, lugares], orden) => ({ restaurante_id: rid, nombre, forma, lugares, orden })));
  if (e3) throw e3;
}

export function NuevoRestaurante({ alTerminar }: { alTerminar: () => void }) {
  const { recargar, elegir, salir, restaurantes } = useSesion();
  const [nombre, setNombre] = useState("");
  const [base, setBase] = useState<"ejemplo" | "vacio">("ejemplo");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  async function crear(e: FormEvent) {
    e.preventDefault();
    setEnviando(true); setError("");
    try {
      const { data: rid, error } = await supabase.rpc("crear_restaurante", { p_nombre: nombre.trim() });
      if (error) throw error;
      if (base === "ejemplo") await sembrarEjemplo(rid as string);
      await recargar();
      elegir(rid as string);
      alTerminar();
    } catch (err) { setError(mensajeError(err)); }
    finally { setEnviando(false); }
  }

  return (
    <main className="alta escalon">
      <span className="sobre" style={{ ["--i" as string]: 0 }}>Paso 1 de 1</span>
      <h1 className="titulo" style={{ ["--i" as string]: 1 }}>¿Cómo se llama tu restaurante?</h1>
      <form onSubmit={crear} className="pila" style={{ ["--i" as string]: 2 }}>
        <label className="campo"><span>Nombre</span>
          <input className="entrada" name="restaurante" autoComplete="organization" required maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Taquería El Güero" />
        </label>
        <div className="campo"><span>Para empezar</span>
          <Segmento etiqueta="Para empezar" valor={base} onCambio={setBase}
            opciones={[{ id: "ejemplo", texto: "Con un ejemplo" }, { id: "vacio", texto: "Vacío" }]} />
          <p className="nota">{base === "ejemplo" ? "Te dejamos un menú y 6 mesas de ejemplo para que lo pruebes. Después los cambias o los borras." : "Empiezas sin menú ni mesas y los capturas tú."}</p>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primario ancho" type="submit" disabled={enviando || !nombre.trim()}>{enviando ? "Creando…" : "Crear restaurante"}</button>
      </form>
      <div className="alta-pie" style={{ ["--i" as string]: 3 }}>
        {restaurantes.length > 0 && <button className="texto" type="button" onClick={() => { elegir(restaurantes[0].id); alTerminar(); }}>Volver a {restaurantes[0].nombre}</button>}
        <button className="texto" type="button" onClick={salir}>Cerrar sesión</button>
      </div>
    </main>
  );
}
