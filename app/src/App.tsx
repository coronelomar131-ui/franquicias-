import { useEffect } from "react";
import { useSesion } from "./estado/sesion";
import { ProveedorEquipo, useEquipo, PERMISOS } from "./estado/equipo";
import { useRuta, type Lugar, type Ruta } from "./lib/ruta";
import { Entrar } from "./pantallas/Entrar";
import { NuevoRestaurante } from "./pantallas/NuevoRestaurante";
import { Marco } from "./pantallas/Marco";
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
  const deEquipo = !!sesion.user.app_metadata?.empleado_id;
  // Una cuenta del equipo sin restaurante es alguien dado de baja: no puede crear uno
  if (deEquipo && (!restaurantes.length || !actual)) return <SinAcceso />;
  if (!restaurantes.length || lugar.ruta === "nuevo" || !actual) return <NuevoRestaurante alTerminar={() => ir("salon")} />;
  return (
    <ProveedorEquipo>
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

  if (modo && !persona) return <div className="cargando" role="status" aria-label="Cargando"><MesaDibujo forma="redonda" lugares={4} ocupadas={4} /></div>;
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

function SinAcceso() {
  const { salir } = useSesion();
  return (
    <main className="alta">
      <h1 className="titulo">Ya no tienes acceso</h1>
      <p className="sub">El dueño te dio de baja de este restaurante. Si es un error, pídele que te vuelva a activar en Ajustes → Equipo.</p>
      <button type="button" className="primario" onClick={salir}>Salir</button>
    </main>
  );
}
