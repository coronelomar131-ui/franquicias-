import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useEquipo } from "../estado/equipo";
import type { Ruta } from "../lib/ruta";

const QUE_VE: { puesto: string; ve: string }[] = [
  { puesto: "Mesero", ve: "Salón: abre mesas, toma pedidos y manda a cocina" },
  { puesto: "Cocina", ve: "Cocina: ve las comandas y las marca listas" },
  { puesto: "Caja", ve: "Salón y Cocina" },
  { puesto: "Gerente", ve: "Salón, Cocina y Menú" },
];

export function ModoEquipo({ rid, ir }: { rid: string; ir: (r: Ruta, param?: string) => void }) {
  const { activar } = useEquipo();
  const [gente, setGente] = useState<number | null>(null);
  useEffect(() => {
    supabase.from("empleados").select("id", { count: "exact", head: true }).eq("restaurante_id", rid).eq("activo", true)
      .then(({ count }) => setGente(count ?? 0));
  }, [rid]);

  return (
    <div className="modo-eq">
      <div className="encabezado">
        <h1 className="titulo" tabIndex={-1}>Modo equipo</h1>
        <p className="sub">Deja esta tableta en el restaurante. Cada quien toca su nombre, pone su PIN y solo ve lo de su puesto. Ajustes y el equipo quedan para ti.</p>
      </div>
      <ul className="que-ve">
        {QUE_VE.map((q) => <li key={q.puesto}><b>{q.puesto}</b><span>{q.ve}</span></li>)}
      </ul>
      <div className="modo-eq-acc">
        <p className="nota">Si nadie toca la pantalla en 3 minutos, vuelve a pedir PIN. Para salir del modo equipo te va a pedir tu contraseña.</p>
        {gente === 0 ? (
          <>
            <p className="error">Primero da de alta a tu equipo con su PIN.</p>
            <button type="button" className="primario" onClick={() => ir("ajustes", "equipo")}>Agregar equipo</button>
          </>
        ) : (
          <button type="button" className="primario" disabled={gente === null} onClick={() => { activar(); ir("salon"); }}>Activar en esta tableta</button>
        )}
      </div>
    </div>
  );
}
