import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { mensajeError } from "../lib/formato";
import { Segmento } from "../componentes/Controles";
import { MesaDibujo } from "../componentes/MesaDibujo";
import { aplicarMarca } from "../lib/marca";
import { codigoGuardado } from "../lib/acceso";
import { AccesoEquipo } from "./AccesoEquipo";

export function Entrar() {
  // Un teléfono que ya usó el código del restaurante abre directo en "Equipo"
  const [quien, setQuien] = useState<"dueno" | "equipo">(() => (codigoGuardado() ? "equipo" : "dueno"));
  const [modo, setModo] = useState<"entrar" | "crear">("entrar");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [sentados, setSentados] = useState(0);

  // La mesa de la portada se llena una vez, como un salón que abre
  useEffect(() => { const t = window.setTimeout(() => setSentados(4), 500); return () => window.clearTimeout(t); }, []);
  // Al salir de una sesión la marca del restaurante se quedaba puesta; la entrada del dueño va con la de Comandero
  useEffect(() => { if (quien === "dueno") aplicarMarca(null); }, [quien]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(""); setAviso(""); setEnviando(true);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email: correo.trim(), password: clave, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (!data.session) setAviso("Te mandamos un correo para confirmar tu cuenta. Ábrelo y regresa aquí para entrar.");
      }
    } catch (err) { setError(mensajeError(err)); }
    finally { setEnviando(false); }
  }

  return (
    <main className="entrar">
      <section className="entrar-portada" aria-hidden="true">
        <span className="sobre">Comandero</span>
        <div className="entrar-mesa"><MesaDibujo forma="cuadrada" lugares={4} ocupadas={sentados} /></div>
        <p className="entrar-lema">Mesas, comandas<br />y caja en un solo lugar.</p>
      </section>
      <section className="entrar-forma escalon">
        <div className="quien-entra" style={{ ["--i" as string]: 0 }}>
          <Segmento etiqueta="Quién entra" valor={quien} onCambio={(q) => { setQuien(q); setError(""); setAviso(""); }}
            opciones={[{ id: "equipo", texto: "Soy del equipo" }, { id: "dueno", texto: "Soy el dueño" }]} />
        </div>
        {quien === "equipo" ? (<>
          <h1 className="titulo" style={{ ["--i" as string]: 1 }}>Entra a trabajar</h1>
          <div style={{ ["--i" as string]: 2 }}><AccesoEquipo /></div>
        </>) : (<>
        <h1 className="titulo" style={{ ["--i" as string]: 1 }}>{modo === "entrar" ? "Entra a tu restaurante" : "Crea tu cuenta"}</h1>
        <div style={{ ["--i" as string]: 2 }}>
          <Segmento etiqueta="Modo" valor={modo} onCambio={(m) => { setModo(m); setError(""); setAviso(""); }}
            opciones={[{ id: "entrar", texto: "Entrar" }, { id: "crear", texto: "Crear cuenta" }]} />
        </div>
        <form onSubmit={enviar} className="pila" style={{ ["--i" as string]: 3 }} noValidate>
          <label className="campo"><span>Correo</span>
            <input className="entrada" type="email" name="email" autoComplete="email" inputMode="email" spellCheck={false} required value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="tu@correo.com" />
          </label>
          <label className="campo"><span>Contraseña</span>
            <input className="entrada" type="password" name="password" autoComplete={modo === "entrar" ? "current-password" : "new-password"} required minLength={6} value={clave} onChange={(e) => setClave(e.target.value)} placeholder={modo === "crear" ? "Mínimo 6 caracteres" : ""} />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          {aviso && <p className="nota-ok" role="status">{aviso}</p>}
          <button className="primario ancho" type="submit" disabled={enviando || !correo.trim() || clave.length < 6}>
            {enviando ? "Un momento…" : modo === "entrar" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>
        <p className="nota" style={{ ["--i" as string]: 4 }}>La cuenta con correo es del dueño. Tu equipo entra en "Soy del equipo" con el código del restaurante y su PIN.</p>
        </>)}
      </section>
    </main>
  );
}
