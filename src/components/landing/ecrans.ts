import type { Rangee } from "./MiniEcran";

/**
 * Les écrans de l'application, avec leur aperçu.
 *
 * Cette liste sert à deux endroits de la page d'accueil : l'inventaire
 * replié, qui la donne en entier, et le héros, dont les cartes en
 * reprennent une partie. Une seule source, donc, pour que les deux ne
 * puissent pas diverger — un écran ajouté ici apparaît aux deux endroits.
 */
export interface Ecran {
  nom: string;
  quoi: string;
  apercu: readonly Rangee[];
}

export const GROUPES_ECRANS: ReadonlyArray<{ titre: string; ecrans: readonly Ecran[] }> = [
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
