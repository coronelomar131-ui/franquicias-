import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { mensajeError } from "../lib/formato";
import { Segmento } from "../componentes/Controles";
import { MesaDibujo } from "../componentes/MesaDibujo";

export function Entrar() {
  const [modo, setModo] = useState<"entrar" | "crear">("entrar");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [sentados, setSentados] = useState(0);

  // La mesa de la portada se llena una vez, como un salón que abre
  useEffect(() => { const t = window.setTimeout(() => setSentados(4), 500); return () => window.clearTimeout(t); }, []);

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
        <h1 className="titulo" style={{ ["--i" as string]: 0 }}>{modo === "entrar" ? "Entra a tu restaurante" : "Crea tu cuenta"}</h1>
        <div style={{ ["--i" as string]: 1 }}>
          <Segmento etiqueta="Modo" valor={modo} onCambio={(m) => { setModo(m); setError(""); setAviso(""); }}
            opciones={[{ id: "entrar", texto: "Entrar" }, { id: "crear", texto: "Crear cuenta" }]} />
        </div>
        <form onSubmit={enviar} className="pila" style={{ ["--i" as string]: 2 }} noValidate>
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
        <p className="nota" style={{ ["--i" as string]: 3 }}>La cuenta es del dueño. Los meseros entran después con su PIN, sin correo.</p>
      </section>
    </main>
  );
}
