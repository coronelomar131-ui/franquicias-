import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSesion } from "../estado/sesion";
import { guardarCodigo } from "../lib/acceso";
import { mensajeError } from "../lib/formato";
import type { Ruta } from "../lib/ruta";
import { useAviso } from "../componentes/Aviso";
import { DobleToque } from "../componentes/Controles";

const QUE_VE: { puesto: string; ve: string }[] = [
  { puesto: "Mesero", ve: "Salón: abre mesas, toma pedidos y manda a cocina" },
  { puesto: "Cocina", ve: "Cocina: ve las comandas y las marca listas" },
  { puesto: "Caja", ve: "Salón y Cocina" },
  { puesto: "Gerente", ve: "Salón, Cocina y Menú (puede editar platillos)" },
];

/** Acceso del equipo: el código del restaurante y cómo se usa. */
export function ModoEquipo({ rid, ir }: { rid: string; ir: (r: Ruta, param?: string) => void }) {
  const { actual, recargar, salir } = useSesion();
  const avisar = useAviso();
  const [gente, setGente] = useState<number | null>(null);
  const codigo = actual?.codigo_equipo ?? "";
  useEffect(() => {
    supabase.from("empleados").select("id", { count: "exact", head: true }).eq("restaurante_id", rid).eq("activo", true)
      .then(({ count }) => setGente(count ?? 0));
  }, [rid]);

  async function cambiarCodigo() {
    const { error } = await supabase.rpc("nuevo_codigo_equipo", { p_restaurante: rid });
    if (error) { avisar(mensajeError(error), "error"); return; }
    await recargar().catch(() => {});
    avisar("Código nuevo listo. El anterior ya no sirve.");
  }

  return (
    <div className="modo-eq">
      <div className="encabezado">
        <h1 className="titulo" tabIndex={-1}>Acceso del equipo</h1>
        <p className="sub">Tu equipo no necesita correo. En la entrada de la app tocan <b>Soy del equipo</b>, ponen este código una sola vez en su teléfono o en la tableta, y después solo su nombre y su PIN.</p>
      </div>

      <div className="codigo-caja">
        <span className="sobre">Código de tu restaurante</span>
        <strong className="codigo-grande" translate="no" aria-label={codigo.split("").join(" ")}>{codigo}</strong>
        <DobleToque className="texto" texto="Cambiar código" pregunta="El anterior dejará de servir. ¿Cambiar?" onConfirmar={cambiarCodigo} />
      </div>

      <ul className="que-ve">
        {QUE_VE.map((q) => <li key={q.puesto}><b>{q.puesto}</b><span>{q.ve}</span></li>)}
      </ul>

      <div className="modo-eq-acc">
        <p className="nota">Cada quien entra con su propia cuenta: lo que hace queda a su nombre y solo ve lo de su puesto. Si nadie toca la pantalla en 3 minutos, se sale solo. Si das de baja a alguien, pierde el acceso al momento.</p>
        {gente === 0 ? (
          <>
            <p className="error">Primero da de alta a tu equipo con su PIN.</p>
            <button type="button" className="primario" onClick={() => ir("ajustes", "equipo")}>Agregar equipo</button>
          </>
        ) : (
          <>
            <p className="nota"><b>¿Esta tableta se queda en el restaurante?</b> Cierra tu sesión aquí y queda lista para que tu equipo entre.</p>
            <button type="button" className="primario" disabled={!codigo} onClick={() => { guardarCodigo(codigo); void salir(); }}>Dejar esta tableta para el equipo</button>
          </>
        )}
      </div>
    </div>
  );
}
