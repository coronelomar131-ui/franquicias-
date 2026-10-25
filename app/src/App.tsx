import { useSesion } from "./estado/sesion";
import { useRuta } from "./lib/ruta";
import { Entrar } from "./pantallas/Entrar";
import { NuevoRestaurante } from "./pantallas/NuevoRestaurante";
import { Marco } from "./pantallas/Marco";
import { Salon } from "./pantallas/Salon";
import { Menu } from "./pantallas/Menu";
import { Mesas } from "./pantallas/Mesas";
import { Equipo } from "./pantallas/Equipo";
import { MesaDibujo } from "./componentes/MesaDibujo";

export function App() {
  const { sesion, cargando, restaurantes, actual } = useSesion();
  const [ruta, ir] = useRuta();
  if (cargando) return <div className="cargando" role="status" aria-label="Cargando"><MesaDibujo forma="redonda" lugares={4} ocupadas={4} /></div>;
  if (!sesion) return <Entrar />;
  if (!restaurantes.length || ruta === "nuevo" || !actual) return <NuevoRestaurante alTerminar={() => ir("salon")} />;
  return (
    <Marco ruta={ruta} ir={ir}>
      {ruta === "salon" && <Salon rid={actual.id} irA={ir} />}
      {ruta === "menu" && <Menu rid={actual.id} />}
      {ruta === "mesas" && <Mesas rid={actual.id} />}
      {ruta === "equipo" && <Equipo rid={actual.id} />}
    </Marco>
  );
}
