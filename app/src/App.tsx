import { useEffect } from "react";
import { useSesion } from "./estado/sesion";
import { ProveedorEquipo, useEquipo, PERMISOS } from "./estado/equipo";
import { useRuta, type Lugar, type Ruta } from "./lib/ruta";
import { Entrar } from "./pantallas/Entrar";
import { NuevoRestaurante } from "./pantallas/NuevoRestaurante";
import { Marco } from "./pantallas/Marco";
import { Bloqueo } from "./pantallas/Bloqueo";
import { Salon } from "./pantallas/Salon";
import { Pedido } from "./pantallas/Pedido";
import { Cocina } from "./pantallas/Cocina";
import { Menu } from "./pantallas/Menu";
import { Ajustes } from "./pantallas/Ajustes";
import { MesaDibujo } from "./componentes/MesaDibujo";

export function App() {
  const { sesion, cargando, restaurantes, actual } = useSesion();
  const [lugar, ir] = useRuta();

  if (cargando) return <div className="cargando" role="status" aria-label="Cargando"><MesaDibujo forma="redonda" lugares={4} ocupadas={4} /></div>;
  if (!sesion) return <Entrar />;
  if (!restaurantes.length || lugar.ruta === "nuevo" || !actual) return <NuevoRestaurante alTerminar={() => ir("salon")} />;
  return (
    <ProveedorEquipo key={actual.id} rid={actual.id}>
      <Turno rid={actual.id} lugar={lugar} ir={ir} />
    </ProveedorEquipo>
  );
}

function Turno({ rid, lugar, ir }: { rid: string; lugar: Lugar; ir: (r: Ruta, param?: string) => void }) {
  const { modo, persona, puede } = useEquipo();
  const { ruta, param } = lugar;
  const permitido = puede(ruta);
  // Si alguien llega a una pantalla que su puesto no ve, lo manda a la primera que sí
  useEffect(() => { if (modo && persona && !permitido) ir(PERMISOS[persona.rol][0]); }, [modo, persona, permitido]); // eslint-disable-line react-hooks/exhaustive-deps

  if (modo && !persona) return <Bloqueo rid={rid} />;
  if (!permitido) return null;
  return (
    <Marco lugar={lugar} ir={ir}>
      {ruta === "salon" && <Salon rid={rid} ir={ir} />}
      {ruta === "pedido" && param && <Pedido key={param} rid={rid} ordenId={param} ir={ir} />}
      {ruta === "cocina" && <Cocina rid={rid} />}
      {ruta === "menu" && <Menu rid={rid} />}
      {ruta === "ajustes" && <Ajustes rid={rid} parte={param} ir={ir} />}
    </Marco>
  );
}
