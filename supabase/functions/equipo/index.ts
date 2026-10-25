// Acceso del equipo sin correo. Dos acciones, ambas públicas porque la persona todavía no tiene sesión:
//   equipo  { codigo }                    → restaurante y lista de personas activas
//   entrar  { codigo, empleado_id, pin }  → token de un solo uso para abrir sesión con verifyOtp
// El PIN lo revisa la base (entrar_con_pin) con su bloqueo de 5 intentos. Cada empleado tiene su
// propia cuenta interna, sin correo real, que entra como miembro 'dispositivo' del restaurante.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  const body = await req.json().catch(() => ({}));
  const codigo = String(body.codigo ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (codigo.length !== 6) return json({ error: "El código tiene 6 letras y números" }, 400);

  try {
    if (body.accion === "equipo") {
      const { data, error } = await admin.rpc("equipo_por_codigo", { p_codigo: codigo });
      if (error) throw error;
      if (!data) return json({ error: "No encontramos ese código. Pídeselo al dueño." }, 404);
      return json(data);
    }

    if (body.accion === "entrar") {
      const empleado = String(body.empleado_id ?? "");
      const pin = String(body.pin ?? "");
      if (!UUID.test(empleado) || !/^[0-9]{4,6}$/.test(pin)) return json({ error: "PIN incorrecto" }, 400);

      const { data: r, error } = await admin.rpc("entrar_con_pin", { p_codigo: codigo, p_empleado: empleado, p_pin: pin });
      if (error) throw error;
      if (!r?.ok) return json({ error: r?.error ?? "PIN incorrecto" }, 401);

      const correo = `e-${empleado}@equipo.comandero.app`;
      const meta = { empleado_id: empleado, restaurante_id: r.restaurante_id, rol: r.rol };
      // La primera vez se crea la cuenta interna; después solo se pide un token nuevo
      let link = await admin.auth.admin.generateLink({ type: "magiclink", email: correo });
      if (link.error) {
        const nueva = await admin.auth.admin.createUser({ email: correo, email_confirm: true, password: crypto.randomUUID() + crypto.randomUUID(), app_metadata: meta });
        if (nueva.error) throw nueva.error;
        link = await admin.auth.admin.generateLink({ type: "magiclink", email: correo });
        if (link.error) throw link.error;
      }
      const usuario = link.data.user!.id;
      // El puesto va en app_metadata (no lo puede cambiar la persona) y queda dentro de su sesión
      const act = await admin.auth.admin.updateUserById(usuario, { app_metadata: meta });
      if (act.error) throw act.error;
      const { error: e2 } = await admin.rpc("vincular_cuenta_empleado", { p_empleado: empleado, p_usuario: usuario });
      if (e2) throw e2;
      return json({ token_hash: link.data.properties.hashed_token });
    }

    return json({ error: "Acción desconocida" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "No se pudo entrar. Intenta otra vez." }, 500);
  }
});
