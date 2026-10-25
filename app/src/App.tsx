import { useSesion } from "./estado/sesion";
import { useRuta } from "./lib/ruta";
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
  const [{ ruta, param }, ir] = useRuta();

  if (cargando) return <div className="cargando" role="status" aria-label="Cargando"><MesaDibujo forma="redonda" lugares={4} ocupadas={4} /></div>;
  if (!sesion) return <Entrar />;
  if (!restaurantes.length || ruta === "nuevo" || !actual) return <NuevoRestaurante alTerminar={() => ir("salon")} />;
  return (
    <Marco ruta={ruta} ir={ir}>
      {ruta === "salon" && <Salon rid={actual.id} ir={ir} />}
      {ruta === "pedido" && param && <Pedido key={param} rid={actual.id} ordenId={param} ir={ir} />}
      {ruta === "cocina" && <Cocina rid={actual.id} />}
      {ruta === "menu" && <Menu rid={actual.id} />}
      {ruta === "ajustes" && <Ajustes rid={actual.id} />}
    </Marco>
  );
}
