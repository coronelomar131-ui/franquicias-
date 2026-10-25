import { useState } from "react";
import { Segmento } from "../componentes/Controles";
import { Negocio } from "./Negocio";
import { Mesas } from "./Mesas";
import { Equipo } from "./Equipo";

type Parte = "negocio" | "mesas" | "equipo";
const LLAVE = "comandero:ajustes";

export function Ajustes({ rid }: { rid: string }) {
  const [parte, setParte] = useState<Parte>(() => { try { return (sessionStorage.getItem(LLAVE) as Parte) || "negocio"; } catch { return "negocio"; } });
  const cambiar = (p: Parte) => { setParte(p); try { sessionStorage.setItem(LLAVE, p); } catch { /* sin almacenamiento */ } };
  return (
    <div className="ajustes">
      <div className="ajustes-seg">
        <Segmento etiqueta="Ajustes" valor={parte} onCambio={cambiar}
          opciones={[{ id: "negocio", texto: "Mi negocio" }, { id: "mesas", texto: "Mesas" }, { id: "equipo", texto: "Equipo" }]} />
      </div>
      <div key={parte} className="entra">
        {parte === "negocio" && <Negocio rid={rid} />}
        {parte === "mesas" && <Mesas rid={rid} />}
        {parte === "equipo" && <Equipo rid={rid} />}
      </div>
    </div>
  );
}
