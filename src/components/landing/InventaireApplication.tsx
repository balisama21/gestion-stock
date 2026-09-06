import React from "react";

/**
 * L'inventaire des écrans livrés.
 *
 * Les six bandes illustrées montrent le travail quotidien ; il restait à
 * dire l'étendue. Plutôt que six bandes de plus — la page est déjà
 * longue — l'application est ici listée écran par écran, dans ses
 * propres groupes et avec ses propres libellés, repris tels quels de sa
 * navigation. Un visiteur retrouvera exactement ces mots une fois
 * entré ; une page d'accueil qui rebaptise les écrans oblige à
 * apprendre deux vocabulaires.
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

export const InventaireApplication: React.FC = () => (
  <section id="inventaire" className="scroll-mt-16 px-5 py-20 sm:py-24">
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

      <div className="mt-12 grid gap-x-14 gap-y-10 sm:grid-cols-2">
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
        verrouille par code PIN entre deux usages, et chaque vendeur ne voit que les écrans que vous
        lui avez ouverts.
      </p>
    </div>
  </section>
);
