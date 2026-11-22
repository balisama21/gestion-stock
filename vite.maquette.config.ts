import path from "node:path";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const ici = import.meta.dirname;

/**
 * LE BANC DE MAQUETTES
 *
 * Un serveur de développement à part, sans le serveur de l'application :
 * il montre les écrans d'une nature de boutique (la pharmacie d'abord)
 * remplis d'une boutique fictive, sur une base en mémoire. Rien ne part
 * vers Supabase — `lib/supabase` est remplacé par `src/maquette/fauxSupabase.ts` —,
 * aucun compte n'est nécessaire.
 *
 *   npx vite --config vite.maquette.config.ts   puis http://localhost:3102/maquette/
 *
 * Jamais construit ni déployé : `vite build` lit `vite.config.ts`.
 */
export default defineConfig({
  root: ici,
  // Son propre cache : lancé à côté du serveur de l'application, il ne
  // lui fait pas recompiler ses dépendances à chaque démarrage.
  cacheDir: path.resolve(ici, "node_modules/.vite-maquette"),
  plugins: [viteReact(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: /^(?:\.{1,2}\/)+(?:lib\/)?supabase$/,
        replacement: path.resolve(ici, "src/maquette/fauxSupabase.ts"),
      },
      { find: "@", replacement: path.resolve(ici, "src") },
    ],
  },
  server: { port: 3102, strictPort: true, fs: { allow: [ici] } },
});
