import { createClient } from "@supabase/supabase-js";

// Valores públicos: la llave publicable está hecha para vivir en el navegador; los permisos los pone RLS.
const url = import.meta.env.VITE_SUPABASE_URL ?? "https://lrfzilmbxmrikqdaseye.supabase.co";
const llave = import.meta.env.VITE_SUPABASE_KEY ?? "sb_publishable_jneCrgBJUet990FfZgS2Xg__UHiZdjA";

export const supabase = createClient(url, llave, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
