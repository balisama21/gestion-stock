import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import netlify from "@netlify/vite-plugin-tanstack-start";

export default defineConfig(({ command }) => ({
  plugins: [
    tanstackStart({
      server: { entry: "server" },
    }),
    // Le plugin Netlify n'est chargé QUE pour le build (`vite build`), où il
    // produit .netlify/v1/functions/server.mjs, l'artefact déployé. Il est
    // volontairement absent de `vite dev`.
    //
    // Pourquoi : en dev, ce plugin démarre en plus un émulateur de fonctions
    // edge qui lance Deno avec `deno eval --allow-scripts`. Ce drapeau
    // n'existe que sur Deno 2.x ; avec une version plus ancienne le
    // processus échoue ("unexpected argument '--allow-scripts' found") et
    // `npm run dev` s'arrête sur "Could not establish a connection to the
    // Netlify Edge Functions local development server".
    //
    // Ce projet n'a aucune fonction edge (pas de dossier netlify/, pas de
    // netlify.toml) et lit sa configuration Supabase dans .env via
    // import.meta.env : l'émulation n'apporte donc rien en local.
    //
    // Le déploiement n'est pas affecté — il passe par `vite build`, où le
    // plugin reste actif.
    ...(command === "build" ? [netlify()] : []),
    viteReact(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    port: 3000,
    strictPort: true, // échoue au lieu de changer de port silencieusement si 3000 est occupé
  },
}));
