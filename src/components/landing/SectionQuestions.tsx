import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Revele } from "./Revele";
import { ESSAI_JOURS, prixAVie, prixMensuel } from "../../lib/offres";

/**
 * Les questions qu'on se pose avant de s'inscrire.
 *
 * Chaque réponse dit ce que le logiciel fait vraiment, y compris quand
 * ce n'est pas à son avantage : il faut Internet, il n'y a pas de
 * version hors ligne, et le paiement passe par un administrateur. Une
 * page d'accueil qui promet ce que le produit ne tient pas se paie au
 * premier jour d'utilisation.
 *
 * Un dépliant natif — `<details>` — plutôt qu'un accordéon écrit à la
 * main : il s'ouvre au clavier, il se cherche avec Ctrl+F même fermé sur
 * les navigateurs récents, et il fonctionne avant que le JavaScript
 * n'arrive.
 */
const QUESTIONS: { q: string; r: string }[] = [
  {
    q: "Faut-il Internet pour s'en servir ?",
    r: "Oui. Vos données vivent sur un serveur, et le logiciel les lit à chaque écran. Il n'y a pas de mode hors ligne : afficher un stock ou un solde enregistré la veille vous ferait prendre une décision sur un chiffre faux, et nous préférons une erreur franche. Une connexion mobile ordinaire suffit — l'application est légère et ne recharge que ce qui a changé.",
  },
  {
    q: "Est-ce que je peux l'installer sur mon téléphone ?",
    r: "Oui, sans passer par un magasin d'applications. Ouvrez le site dans votre navigateur et choisissez « Ajouter à l'écran d'accueil » : une icône apparaît, et le logiciel s'ouvre en plein écran comme n'importe quelle autre application.",
  },
  {
    q: "Plusieurs personnes peuvent-elles travailler dessus ?",
    r: "Oui. Vous invitez vos collaborateurs par courriel et vous choisissez ce que chacun voit : un vendeur peut enregistrer des ventes sans voir vos prix d'achat, un comptable peut lire sans rien modifier, un livreur ne voit que ses propres courses. Ces limites sont posées sur le serveur, pas seulement dans l'écran.",
  },
  {
    q: `Que se passe-t-il au bout des ${ESSAI_JOURS} jours d'essai ?`,
    r: "La boutique se verrouille en lecture : rien n'est effacé, rien n'est perdu, vous ne pouvez simplement plus enregistrer de nouvelles écritures tant qu'elle n'est pas activée. Une fois le paiement fait et le code saisi, tout reprend là où vous vous étiez arrêté.",
  },
  {
    q: "Faut-il s'abonner, ou payer une fois ?",
    r: `Les deux existent, au choix : ${prixMensuel()} par mois et par boutique, à renouveler quand vous le voulez, ou ${prixAVie()} une seule fois et la boutique reste active à vie. Les deux formules ouvrent exactement le même logiciel. Si vous ouvrez une seconde boutique, elle demande sa propre activation.`,
  },
  {
    q: "Le paiement mensuel est-il prélevé automatiquement ?",
    r: "Non, et c'est volontaire : rien n'est prélevé sur votre compte. Vous payez le mois suivant quand vous le décidez, par MVola, et vous recevez un code. Si vous arrêtez de payer, la boutique se verrouille en lecture — vos données restent, et repartent dès le paiement suivant.",
  },
  {
    q: "Est-ce que ça marche sans code-barres ?",
    r: "Oui, et c'est le cas le plus courant. Vous choisissez le produit dans une liste. Si vous étiquetez vos articles, le code-barres devient un raccourci : une douchette ou l'appareil photo du téléphone remplit le panier tout seul.",
  },
  {
    q: "Puis-je imprimer des reçus ?",
    r: "Oui, au format d'un ticket de caisse — 58 ou 80 mm — pour une imprimante thermique, ou en A4 pour une facture. Chaque document s'enregistre aussi en PDF ou en image, ce qui permet de l'envoyer par message quand le client n'est pas devant vous.",
  },
  {
    q: "Est-ce adapté à mon métier ?",
    r: "Le logiciel se règle : vous renommez les modules avec vos mots, vous retirez ceux qui ne vous servent pas, et vous ajoutez vos propres champs aux fiches. Une boutique qui vend au comptoir n'affiche ni commandes ni livraisons ; une autre qui livre les active.",
  },
  {
    q: "Mes données m'appartiennent-elles ?",
    r: "Oui. Vous pouvez à tout moment exporter vos ventes, vos achats et vos dépenses dans un tableur. Chaque boutique est isolée des autres : personne d'autre que vous et les personnes que vous invitez ne peut lire vos chiffres.",
  },
];

export const SectionQuestions: React.FC = () => {
  const [ouverte, setOuverte] = useState<number | null>(0);

  return (
    <section id="questions" className="px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <Revele>
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Questions
          </p>
          <h2 className="mt-3 text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Ce qu&apos;on nous demande avant de commencer.
          </h2>
        </Revele>

        <Revele delai={120}>
          <div className="mt-8 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {QUESTIONS.map((item, i) => (
              <details
                key={item.q}
                open={ouverte === i}
                onToggle={(e) => {
                  if ((e.currentTarget as HTMLDetailsElement).open) setOuverte(i);
                  else if (ouverte === i) setOuverte(null);
                }}
                className="group"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-foreground hover:bg-muted">
                  <span className="min-w-0">{item.q}</span>
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">{item.r}</p>
              </details>
            ))}
          </div>
        </Revele>
      </div>
    </section>
  );
};
