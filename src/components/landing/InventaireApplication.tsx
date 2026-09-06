import React from "react";
import { MiniEcran, type Rangee } from "./MiniEcran";

/**
 * L'inventaire des écrans livrés.
 *
 * Les six bandes illustrées montrent le travail quotidien ; celle-ci dit
 * l'étendue. Chaque écran est nommé par le libellé exact de la
 * navigation — un visiteur retrouvera ces mots dans le menu une fois
 * entré — et accompagné d'un aperçu de ce qu'il contient.
 *
 * Les aperçus partagent un gabarit, contrairement aux six objets du
 * registre. C'est voulu : ceci est un catalogue, et un catalogue se lit
 * comme une liste. La variété tient à ce que chaque miniature montre.
 *
 * La liste est repliée par défaut. Déployée, elle doublait la hauteur de
 * la page sur téléphone pour une information qu'on consulte une fois,
 * avant de se décider. Le repli est un "details" natif : il s'ouvre au
 * clavier, fonctionne sans JavaScript, et son contenu reste lisible par
 * un moteur de recherche même fermé.
 *
 * Rien n'est ajouté qui n'existe pas : chaque ligne correspond à un
 * écran ou à un réglage réellement livré.
 */
interface Ecran {
  nom: string;
  quoi: string;
  apercu: readonly Rangee[];
}

const GROUPES: ReadonlyArray<{ titre: string; ecrans: readonly Ecran[] }> = [
  {
    titre: "Pilotage",
    ecrans: [
      {
        nom: "Tableau de bord",
        quoi: "Le chiffre du jour, les ruptures, ce qui reste à encaisser",
        apercu: [
          { type: "paire", g: "Aujourd’hui", d: "412 000", fort: true },
          { type: "barres", v: [40, 62, 48, 75, 90] },
        ],
      },
      {
        nom: "Bilan",
        quoi: "Mois par mois et sur l’année, avec les douze mois toujours affichés",
        apercu: [
          { type: "barres", v: [35, 52, 44, 68, 60, 82] },
          { type: "paire", g: "Année", d: "2,4 M" },
        ],
      },
      {
        nom: "Historique",
        quoi: "Le journal de tout ce qui a été fait, daté et attribué",
        apercu: [
          { type: "texte", t: "06/09  Vente V001" },
          { type: "texte", t: "06/09  Achat A012", sourdine: true },
          { type: "texte", t: "05/09  Dépense", sourdine: true },
        ],
      },
      {
        nom: "Statistiques",
        quoi: "Produits qui tournent, marges, évolution",
        apercu: [
          { type: "paire", g: "Riz 25 kg", d: "38 %" },
          { type: "jauge", pct: 38, libelle: "part du chiffre d’affaires" },
        ],
      },
    ],
  },
  {
    titre: "Ventes",
    ecrans: [
      {
        nom: "Ventes",
        quoi: "Encaissement comptant ou à crédit, reçu imprimé dans la foulée",
        apercu: [
          { type: "paire", g: "Huile 5 L", d: "50 000" },
          { type: "paire", g: "Savon 200 g", d: "12 000" },
          { type: "paire", g: "Total", d: "62 000", fort: true },
        ],
      },
      {
        nom: "Commandes",
        quoi: "De la commande à la livraison, avec l’état de chacune",
        apercu: [
          { type: "puces", p: ["Commandée", "Préparée"] },
          { type: "jauge", pct: 66, libelle: "CMD-014 · livraison lundi" },
        ],
      },
      {
        nom: "Clients",
        quoi: "Fiche, historique d’achat et solde dû",
        apercu: [
          { type: "paire", g: "Tiana R.", d: "10 000" },
          { type: "paire", g: "Hery A.", d: "0" },
          { type: "paire", g: "Noro B.", d: "25 000" },
        ],
      },
      {
        nom: "Paiements à recevoir",
        quoi: "Qui doit quoi, depuis quand, et les relances",
        apercu: [
          { type: "paire", g: "Tiana R.", d: "10 000", fort: true },
          { type: "texte", t: "depuis 12 jours", sourdine: true },
          { type: "puces", p: ["À relancer"] },
        ],
      },
    ],
  },
  {
    titre: "Stock",
    ecrans: [
      {
        nom: "Produits",
        quoi: "Catalogue, prix, variantes et seuil d’alerte",
        apercu: [
          { type: "paire", g: "Riz 25 kg", d: "3" },
          { type: "paire", g: "Huile 5 L", d: "24" },
          { type: "puces", p: ["Seuil 5"] },
        ],
      },
      {
        nom: "Achats",
        quoi: "Entrées de marchandise et ce qu’elles ont coûté",
        apercu: [
          { type: "paire", g: "Entrée A012", d: "300 000" },
          { type: "texte", t: "12 sacs · fournisseur", sourdine: true },
        ],
      },
      {
        nom: "Alertes de rupture",
        quoi: "Le signalement arrive avant que le rayon soit vide",
        apercu: [
          { type: "puces", p: ["Sous le seuil"] },
          { type: "paire", g: "Riz 25 kg", d: "3 / 5", fort: true },
        ],
      },
    ],
  },
  {
    titre: "Finance",
    ecrans: [
      {
        nom: "Capital",
        quoi: "Apports, retraits et capital engagé",
        apercu: [
          { type: "paire", g: "Apports", d: "1 500 000" },
          { type: "paire", g: "Retraits", d: "− 200 000" },
          { type: "paire", g: "Engagé", d: "1,3 M", fort: true },
        ],
      },
      {
        nom: "Dépenses",
        quoi: "Sorties d’argent et retraits de caisse des vendeurs",
        apercu: [
          { type: "paire", g: "Transport", d: "− 24 000" },
          { type: "paire", g: "Retrait Kanto", d: "− 50 000" },
        ],
      },
      {
        nom: "Reçus et factures",
        quoi: "Ticket 58 ou 80 mm, facture A4, PDF ou image",
        apercu: [
          { type: "puces", p: ["58 mm", "80 mm", "A4"] },
          { type: "paire", g: "TOTAL", d: "62 000", fort: true },
        ],
      },
    ],
  },
  {
    titre: "Équipe",
    ecrans: [
      {
        nom: "Vendeurs",
        quoi: "L’activité de chacun, son encaissé et son solde en poche",
        apercu: [
          { type: "paire", g: "Kanto", d: "93 000" },
          { type: "paire", g: "Hery", d: "41 000" },
          { type: "texte", t: "solde en poche", sourdine: true },
        ],
      },
      {
        nom: "Invitations et accès",
        quoi: "Un profil recommandé par rôle, ajustable module par module",
        apercu: [
          { type: "puces", p: ["Vendeur", "Gestionnaire"] },
          { type: "bascules", libelles: ["Ventes", "Trésorerie"], actives: 1 },
        ],
      },
      {
        nom: "Mon activité",
        quoi: "Ce que le vendeur voit de son propre travail",
        apercu: [
          { type: "paire", g: "Mes ventes", d: "9" },
          { type: "jauge", pct: 72, libelle: "encaissé du jour" },
        ],
      },
    ],
  },
  {
    titre: "Réglages",
    ecrans: [
      {
        nom: "Ma boutique",
        quoi: "Nom, adresse, logo — ce qui s’imprime en tête des documents",
        apercu: [
          { type: "texte", t: "Épicerie du Centre" },
          { type: "texte", t: "Lot IVG 124", sourdine: true },
          { type: "texte", t: "Logo · en-tête", sourdine: true },
        ],
      },
      {
        nom: "Notifications",
        quoi: "Ce dont vous voulez être prévenu, et ce que vous préférez ignorer",
        apercu: [
          {
            type: "bascules",
            libelles: ["Rupture de stock", "Paiement reçu", "Nouvelle vente"],
            actives: 2,
          },
        ],
      },
      {
        nom: "Sécurité",
        quoi: "Code PIN, expiration de session, mot de passe",
        apercu: [
          { type: "points", n: 4, remplis: 4, libelle: "code PIN" },
          { type: "texte", t: "session · 30 min", sourdine: true },
        ],
      },
      {
        nom: "Préférences",
        quoi: "Thème clair ou sombre, format des dates, export tableur",
        apercu: [
          { type: "puces", p: ["Clair", "Sombre"] },
          { type: "texte", t: "JJ/MM/AAAA · export .xlsx", sourdine: true },
        ],
      },
    ],
  },
];

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
                {ecrans.map(({ nom, quoi, apercu }) => (
                  <div key={nom} className="reglure flex items-center gap-4 py-4">
                    <MiniEcran titre={nom} rangees={apercu} />
                    <div className="min-w-0">
                      <dt className="text-[0.9375rem] font-medium">{nom}</dt>
                      <dd
                        className="mt-0.5 text-[0.875rem] leading-relaxed"
                        style={{ color: "var(--carbone-doux)" }}
                      >
                        {quoi}
                      </dd>
                    </div>
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
