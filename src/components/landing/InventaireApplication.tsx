import React from "react";

/**
 * L'inventaire des écrans livrés.
 *
 * Les six bandes illustrées montrent le travail quotidien ; il restait à
 * dire l'étendue. Plutôt que six bandes de plus, l'application est ici
 * listée écran par écran, dans ses propres groupes et avec ses propres
 * libellés, repris tels quels de sa navigation. Un visiteur retrouvera
 * exactement ces mots une fois entré ; une page d'accueil qui rebaptise
 * les écrans oblige à apprendre deux vocabulaires.
 *
 * La liste est repliée par défaut. Déployée, elle doublait la hauteur de
 * la page sur téléphone — plus de huit écrans de défilement — pour une
 * information qu'on consulte une fois, avant de se décider. Le repli est
 * un "details" natif plutôt qu'un état React : il s'ouvre au clavier,
 * fonctionne sans JavaScript, et son contenu reste lisible par un moteur
 * de recherche même fermé. Son ouverture est le seul autre mouvement de
 * la page, et il répond à un geste.
 *
 * Rien n'est ajouté qui n'existe pas : chaque ligne correspond à un
 * écran ou à un réglage réellement livré.
 */
const GROUPES = [
  {
    titre: "Pilotage",
    ecrans: [
      ["Tableau de bord", "Le chiffre du jour, les ruptures, ce qui reste à encaisser"],
      ["Bilan", "Mois par mois et sur l'année, avec les douze mois toujours affichés"],
      ["Historique", "Le journal de tout ce qui a été fait, daté et attribué"],
      ["Statistiques", "Produits qui tournent, marges, évolution"],
    ],
  },
  {
    titre: "Ventes",
    ecrans: [
      ["Ventes", "Encaissement comptant ou à crédit, reçu imprimé dans la foulée"],
      ["Commandes", "De la commande à la livraison, avec l'état de chacune"],
      ["Clients", "Fiche, historique d'achat et solde dû"],
      ["Paiements à recevoir", "Qui doit quoi, depuis quand, et les relances"],
    ],
  },
  {
    titre: "Stock",
    ecrans: [
      ["Produits", "Catalogue, prix, variantes et seuil d'alerte"],
      ["Achats", "Entrées de marchandise et ce qu'elles ont coûté"],
      ["Alertes de rupture", "Le signalement arrive avant que le rayon soit vide"],
    ],
  },
  {
    titre: "Finance",
    ecrans: [
      ["Capital", "Apports, retraits et capital engagé"],
      ["Dépenses", "Sorties d'argent et retraits de caisse des vendeurs"],
      ["Reçus et factures", "Ticket 58 ou 80 mm, facture A4, PDF ou image"],
    ],
  },
  {
    titre: "Équipe",
    ecrans: [
      ["Vendeurs", "L'activité de chacun, son encaissé et son solde en poche"],
      ["Invitations et accès", "Un profil recommandé par rôle, ajustable module par module"],
      ["Mon activité", "Ce que le vendeur voit de son propre travail"],
    ],
  },
  {
    titre: "Réglages",
    ecrans: [
      ["Ma boutique", "Nom, adresse, logo — ce qui s'imprime en tête des documents"],
      ["Notifications", "Ce dont vous voulez être prévenu, et ce que vous préférez ignorer"],
      ["Sécurité", "Code PIN, expiration de session, mot de passe"],
      ["Préférences", "Thème clair ou sombre, format des dates, export tableur"],
    ],
  },
] as const;

/** Déduit des données : le chiffre annoncé ne peut pas mentir. */
const NOMBRE_ECRANS = GROUPES.reduce((n, g) => n + g.ecrans.length, 0);

export const InventaireApplication: React.FC = () => (
  <section id="inventaire" className="scroll-mt-16 px-5 py-20 sm:py-24">
    <style>{`
      .inventaire > summary::-webkit-details-marker { display: none; }
      .inventaire > summary:hover { background: color-mix(in srgb, var(--papier) 70%, transparent); }
      .inventaire .inv-fermer { display: none; }
      .inventaire[open] .inv-fermer { display: inline; }
      .inventaire[open] .inv-ouvrir { display: none; }
      .inventaire[open] .inv-chevron { transform: rotate(180deg); }
    `}</style>

    <div className="mx-auto max-w-5xl">
      <h2 className="titrage text-[clamp(1.6rem,4.6vw,2.3rem)]">
        L&apos;application, écran par écran
      </h2>
      <p
        className="mt-4 max-w-[52ch] text-[0.95rem] leading-relaxed"
        style={{ color: "var(--carbone-doux)" }}
      >
        Les noms ci-dessous sont ceux que vous retrouverez dans le menu une fois entré. Chaque écran
        existe ; rien n&apos;est annoncé pour plus tard.
      </p>

      <details className="inventaire mt-8">
        <summary
          className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border px-5 py-3 text-sm font-semibold transition-colors"
          style={{ borderColor: "var(--reglure)", color: "var(--carbone)" }}
        >
          <span className="inv-ouvrir">Voir les {NOMBRE_ECRANS} écrans</span>
          <span className="inv-fermer">Masquer la liste</span>
          <svg
            aria-hidden
            viewBox="0 0 12 12"
            className="inv-chevron h-3 w-3 transition-transform"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M2 4.5 L6 8.5 L10 4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>

        <div className="mt-10 grid gap-x-14 gap-y-10 sm:grid-cols-2">
          {GROUPES.map(({ titre, ecrans }) => (
            <div key={titre}>
              <h3 className="titrage text-[1.05rem]">{titre}</h3>
              <dl className="mt-3">
                {ecrans.map(([nom, quoi]) => (
                  <div key={nom} className="reglure py-3">
                    <dt className="text-[0.9375rem] font-medium">{nom}</dt>
                    <dd
                      className="mt-0.5 text-[0.875rem] leading-relaxed"
                      style={{ color: "var(--carbone-doux)" }}
                    >
                      {quoi}
                    </dd>
                  </div>
                ))}
                <div className="reglure" />
              </dl>
            </div>
          ))}
        </div>

        <p
          className="mt-12 max-w-[54ch] text-[0.875rem] leading-relaxed"
          style={{ color: "var(--carbone-doux)" }}
        >
          L&apos;application s&apos;installe aussi sur le téléphone depuis le navigateur, se
          verrouille par code PIN entre deux usages, et chaque vendeur ne voit que les écrans que
          vous lui avez ouverts.
        </p>
      </details>
    </div>
  </section>
);
