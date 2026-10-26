import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/saira-condensed/500.css";
import "@fontsource/saira-condensed/600.css";
import "@fontsource/saira-condensed/700.css";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "./estilos/base.css";
import "./estilos/pantallas.css";
import { ProveedorSesion } from "./estado/sesion";
import { ProveedorAviso } from "./componentes/Aviso";
import { App } from "./App";

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <ProveedorAviso>
      <ProveedorSesion>
        <App />
      </ProveedorSesion>
    </ProveedorAviso>
  </StrictMode>
);

// Guarda la app en el aparato para abrirla sin internet (solo en la versión publicada)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); });
}
