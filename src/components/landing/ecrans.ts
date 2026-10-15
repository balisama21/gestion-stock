/**
 * Les écrans de l'application, rangés par groupe.
 *
 * Source de la grille « Tout ce qu'il y a dedans » de la page d'accueil :
 * un écran ajouté ici y apparaît.
 */
export interface Ecran {
  nom: string;
  quoi: string;
}

export const GROUPES_ECRANS: ReadonlyArray<{ titre: string; ecrans: readonly Ecran[] }> = [
  {
    titre: "Pilotage",
    ecrans: [
      {
        nom: "Tableau de bord",
        quoi: "Le chiffre du jour, les ruptures, ce qui reste à encaisser",
      },
      {
        nom: "Bilan",
        quoi: "Mois par mois et sur l’année, avec les douze mois toujours affichés",
      },
      {
        nom: "Historique",
        quoi: "Le journal de tout ce qui a été fait, daté et attribué",
      },
      {
        nom: "Statistiques",
        quoi: "Produits qui tournent, marges, évolution",
      },
    ],
  },
  {
    // Le seul groupe qui ne parle pas de marchandise ni d’argent. Il est
    // placé tôt parce que c’est par là qu’on commence sa journée :
    // savoir ce qui est en retard avant d’ouvrir la caisse.
    titre: "Organisation",
    ecrans: [
      {
        nom: "Vue d’ensemble",
        quoi: "Ce que l’équipe doit faire aujourd’hui, et ce qui a dérapé",
      },
      {
        nom: "Tâches",
        quoi: "Qui fait quoi, pour quand, et ce qui a dépassé l’échéance",
      },
      {
        nom: "Agenda",
        quoi: "Rendez-vous et réunions, avec les échéances que le métier porte déjà",
      },
      {
        nom: "Rappels",
        quoi: "Prévenu avant un rendez-vous, alerté quand une échéance passe",
      },
    ],
  },
  {
    titre: "Ventes",
    ecrans: [
      {
        nom: "Ventes",
        quoi: "Encaissement comptant ou à crédit, reçu imprimé dans la foulée",
      },
      {
        nom: "Commandes",
        quoi: "De la commande à la livraison, avec l’état de chacune",
      },
      {
        nom: "Clients",
        quoi: "Fiche, historique d’achat et solde dû",
      },
      {
        nom: "Paiements à recevoir",
        quoi: "Qui doit quoi, depuis quand, et les relances",
      },
      {
        nom: "Devis",
        quoi: "Un devis accepté devient une vente sans être ressaisi",
      },
      {
        nom: "Livraisons",
        quoi: "Qui livre quoi, où en est chaque course, et l’argent remis",
      },
    ],
  },
  {
    titre: "Stock",
    ecrans: [
      {
        nom: "Produits",
        quoi: "Catalogue, prix, variantes et seuil d’alerte",
      },
      {
        nom: "Achats",
        quoi: "Entrées de marchandise et ce qu’elles ont coûté",
      },
      {
        nom: "Alertes de rupture",
        quoi: "Le signalement arrive avant que le rayon soit vide",
      },
      {
        nom: "Fournisseurs",
        quoi: "Ce que vous devez à chacun, et depuis quand",
      },
      {
        nom: "Prestataires",
        quoi: "Les services que vous achetez : transport, réparation, façon",
      },
    ],
  },
  {
    titre: "Finance",
    ecrans: [
      {
        nom: "Capital",
        quoi: "Apports, retraits et capital engagé",
      },
      {
        nom: "Dépenses",
        quoi: "Sorties d’argent et retraits de caisse des vendeurs",
      },
      {
        nom: "Reçus et factures",
        quoi: "Ticket 58 ou 80 mm, facture A4, PDF ou image",
      },
    ],
  },
  {
    titre: "Équipe",
    ecrans: [
      {
        nom: "Vendeurs",
        quoi: "L’activité de chacun, son encaissé et son solde en poche",
      },
      {
        nom: "Invitations et accès",
        quoi: "Un profil recommandé par rôle, ajustable module par module",
      },
      {
        nom: "Mon activité",
        quoi: "Ce que le vendeur voit de son propre travail",
      },
    ],
  },
  {
    titre: "Réglages",
    ecrans: [
      {
        nom: "Ma boutique",
        quoi: "Nom, adresse, logo — ce qui s’imprime en tête des documents",
      },
      {
        nom: "Notifications",
        quoi: "Ce dont vous voulez être prévenu, et ce que vous préférez ignorer",
      },
      {
        nom: "Sécurité",
        quoi: "Code PIN, expiration de session, mot de passe",
      },
      {
        nom: "Préférences",
        quoi: "Thème clair ou sombre, format des dates, export tableur",
      },
    ],
  },
];
