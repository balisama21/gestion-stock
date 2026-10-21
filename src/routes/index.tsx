import { createFileRoute } from "@tanstack/react-router";
import BalsamaApp from "../BalsamaApp";
import { hoteDuRendu, marqueCourante } from "../lib/marque";
import { donneesStructurees, hoteIndexable, lienCanonique } from "../lib/seo";

// Titre, description et aperçus viennent de la racine (`__root.tsx`) ;
// la page d'accueil, seule page publique, y ajoute son adresse
// canonique et ses données structurées, sur le domaine de sa marque.
export const Route = createFileRoute("/")({
  head: () => {
    const marque = marqueCourante();
    const hote = hoteDuRendu();
    const canonique = lienCanonique(marque, hote);
    return {
      meta: [
        { property: "og:url", content: canonique },
        ...(hoteIndexable(hote, marque)
          ? [{ "script:ld+json": donneesStructurees(marque, hote) }]
          : []),
      ],
      links: [{ rel: "canonical", href: canonique }],
    };
  },
  component: BalsamaApp,
});
