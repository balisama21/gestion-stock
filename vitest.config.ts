import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * LES TESTS ONT LEUR PROPRE CONFIGURATION
 *
 * Volontairement séparée de `vite.config.ts`. Celle-ci monte TanStack
 * Start, qui construit un paquet client ET un paquet serveur : tout cet
 * appareillage n'apporte rien à des tests qui exercent des fonctions et
 * un composant, et il ferait payer son temps de démarrage à chaque
 * lancement.
 *
 * `jsdom` donne un `document` et un `localStorage` — le second est
 * précisément ce que testent les tests de la boutique retenue.
 *
 * `globals: false` : chaque test importe `describe`, `it` et `expect`
 * de « vitest ». Un import de plus par fichier, en échange de quoi rien
 * n'apparaît dans la portée globale sans qu'on l'ait écrit, et le
 * `tsconfig` de l'application n'a pas à déclarer de types globaux.
 */
export default defineConfig({
  // Rien à déclarer pour le JSX : Vitest 5 transforme avec oxc, dont la
  // transformation automatique est déjà celle de React 19. Une option
  // `esbuild` ici serait ignorée, avec un avertissement à chaque
  // lancement.
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    globals: false,
    restoreMocks: true,
    /*
     * Cinq secondes ne suffisent pas aux bancs qui montent un ecran
     * entier.
     *
     * Les tests de `FacturationPage` rendent la liste, la barre
     * d indicateurs, les filtres et une modale a chaque cas. Seuls, ils
     * passent en moins d une seconde ; lances en meme temps que les
     * quarante autres fichiers sur une machine chargee, ils depassaient
     * parfois le delai — un echec qui ne dit rien du code, et qui rend
     * la suite peu fiable, donc vite ignoree.
     *
     * Le delai ne cache aucune attente : ce qui est teste reste
     * synchrone ou resolu en quelques millisecondes.
     */
    testTimeout: 20_000,
  },
});
