import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables. Check your .env file.");
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // "implicit" (et non "pkce") : nécessaire car les liens de récupération
    // de mot de passe (et d'invitation) sont générés dans un contexte
    // (PowerShell, ou l'app mobile mail du client) différent du navigateur
    // qui finira par ouvrir le lien. Le flow PKCE échoue dans ce cas car il
    // exige un vérificateur stocké dans le navigateur d'origine.
    flowType: "implicit",
  },
});