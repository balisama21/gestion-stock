import { from, rpc } from "./faussebase";

/**
 * Le client Supabase du banc de maquettes : chaque requête est servie
 * par la base en mémoire. Branché à la place de `lib/supabase` par
 * `vite.maquette.config.ts` ; l'application ne le voit jamais.
 */
export const supabase = {
  from,
  rpc,
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  channel: () => ({
    on() {
      return this;
    },
    subscribe() {
      return this;
    },
  }),
  removeChannel: () => undefined,
  storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
} as any;

export const retourGoogleAndroid = null;
