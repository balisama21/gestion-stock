/**
 * Le mode d'emploi intégré, écran par écran.
 *
 * Une langue = un dictionnaire. Pour ajouter le malgache, remplir `mg`
 * avec les mêmes clés : une fiche absente retombe sur le français.
 */
export type LangueAide = "fr" | "mg";

export interface FicheAide {
  titre: string;
  /** Une phrase : à quoi sert l'écran. */
  resume: string;
  /** Les gestes les plus courants, dans l'ordre. */
  etapes?: { titre: string; texte: string }[];
  /** Les questions qu'on se pose quand on bloque. */
  questions?: { q: string; r: string }[];
}

type Dictionnaire = Record<string, FicheAide>;

const fr: Dictionnaire = {
  general: {
    titre: "Bienvenue",
    resume:
      "Cette aide suit l'écran où vous êtes. Changez d'écran puis rouvrez « ? » pour lire l'explication correspondante.",
    questions: [
      {
        q: "Je ne vois pas un menu que mon collègue a",
        r: "Les menus dépendent des droits donnés par le propriétaire (Paramètres → Équipe) et des modules activés (Paramètres → Vocabulaire et modules).",
      },
      {
        q: "L'application est bloquée en lecture seule",
        r: "La période d'essai ou l'abonnement est terminé. Le propriétaire peut le renouveler dans Paramètres → Abonnement.",
      },
    ],
  },
  dashboard: {
    titre: "Tableau de bord",
    resume:
      "Le résumé de la journée : trésorerie, ventes, stock et ce qui demande votre attention.",
    etapes: [
      {
        titre: "Lire la barre du haut",
        texte: "Chaque chiffre dit sous lui-même la période qu'il couvre.",
      },
      {
        titre: "Ouvrir un détail",
        texte: "Cliquez sur une carte pour voir d'où vient le chiffre.",
      },
      {
        titre: "Déplier les cartes longues",
        texte: "Le calendrier et le journal arrivent repliés : le chevron les ouvre.",
      },
    ],
  },
  ventes: {
    titre: "Ventes",
    resume: "La caisse : enregistrer une vente, encaisser, imprimer un reçu.",
    etapes: [
      {
        titre: "Nouvelle vente",
        texte: "Choisissez les produits, la quantité, puis le mode de paiement.",
      },
      {
        titre: "Paiement partiel",
        texte:
          "Saisissez ce que le client paie maintenant : le reste apparaît dans « Paiements à recevoir ».",
      },
      {
        titre: "Commission",
        texte:
          "Sur une prestation, « Ajouter une commission » propose le taux réglé dans Paramètres → Réglages métier. Le total ne change pas.",
      },
    ],
    questions: [
      { q: "J'ai fait une erreur sur une vente", r: "Ouvrez la vente puis « Modifier la vente »." },
    ],
  },
  facturation: {
    titre: "Facturation",
    resume: "Factures, reçus, proformas et avoirs, prêts à imprimer ou à envoyer.",
    etapes: [
      {
        titre: "Créer un document",
        texte: "Bouton « Nouveau document » en haut de page, puis choisissez le type.",
      },
      { titre: "Envoyer", texte: "Depuis le document : téléchargement PDF ou envoi." },
    ],
    questions: [{ q: "Changer le logo ou les couleurs", r: "Paramètres → Documents." }],
  },
  clients: {
    titre: "Clients",
    resume: "Votre carnet de clients, avec leurs achats et ce qu'ils doivent.",
    etapes: [
      {
        titre: "Voir une fiche",
        texte: "Cliquez sur un client : son historique s'affiche à droite.",
      },
    ],
  },
  paiements: {
    titre: "Paiements à recevoir",
    resume: "Tout l'argent que vos clients vous doivent encore.",
    etapes: [
      { titre: "Encaisser un reste", texte: "Ouvrez la ligne et saisissez le montant reçu." },
    ],
  },
  devis: {
    titre: "Devis",
    resume:
      "Proposer un prix avant la vente. Un devis accepté se transforme en vente sans ressaisie.",
  },
  commandes: {
    titre: "Commandes",
    resume:
      "Les commandes prises à l'avance (téléphone, réseaux sociaux) : le stock est réservé jusqu'à la livraison.",
  },
  livraisons: {
    titre: "Livraisons",
    resume: "Suivre qui livre quoi, et l'argent que les livreurs rapportent.",
  },
  produits: {
    titre: "Produits",
    resume: "Le catalogue : prix, stock, seuils d'alerte.",
    etapes: [
      {
        titre: "Ajouter un produit",
        texte: "Bouton « Nouveau produit », puis nom, prix d'achat et prix de vente.",
      },
      {
        titre: "Corriger le stock",
        texte: "Ouvrez le produit, section « Corriger le stock » : la correction est tracée.",
      },
    ],
    questions: [
      {
        q: "Le prix de vente se calcule tout seul ?",
        r: "Seulement si vous l'avez activé dans Paramètres → Prix de vente.",
      },
    ],
  },
  achats: {
    titre: "Achats",
    resume:
      "Ce que vous achetez aux fournisseurs. Un achat augmente le stock et sort de la caisse (ou crée une dette si payé plus tard).",
  },
  factures_achat: {
    titre: "Factures d'achat",
    resume: "Les factures reçues de vos fournisseurs et leur règlement.",
  },
  fournisseurs: {
    titre: "Fournisseurs",
    resume: "Vos fournisseurs, leurs coordonnées et ce que vous leur devez.",
  },
  prestataires: {
    titre: "Prestataires",
    resume: "Les personnes ou entreprises qui travaillent pour vous (transport, réparation…).",
  },
  capital: {
    titre: "Capital",
    resume: "La trésorerie de la boutique : ce qui est entré, sorti, et les apports d'argent.",
  },
  depenses: {
    titre: "Dépenses",
    resume:
      "Tout ce que la boutique paie hors achat de marchandise : loyer, électricité, transport…",
    etapes: [
      { titre: "Nouvelle dépense", texte: "Montant, poste de dépense et qui l'a payée." },
      { titre: "Classer", texte: "Les postes se gèrent dans Paramètres → Listes." },
    ],
    questions: [
      {
        q: "Un employé a payé de sa poche",
        r: "Utilisez plutôt « Notes de frais » : il déclare, vous validez, et le remboursement crée la dépense tout seul.",
      },
    ],
  },
  notes_frais: {
    titre: "Notes de frais",
    resume:
      "Quand quelqu'un paie une dépense de la boutique avec son propre argent, il la déclare ici pour être remboursé.",
    etapes: [
      {
        titre: "1. Déclarer",
        texte:
          "« Nouvelle note » : motif, montant, devise et justificatif. La note part « À valider ».",
      },
      {
        titre: "2. Valider ou refuser",
        texte: "Le responsable ouvre la note et la valide, ou la refuse en expliquant pourquoi.",
      },
      {
        titre: "3. Rembourser",
        texte:
          "Sur une note validée, « Rembourser » crée la dépense et sort l'argent de la caisse.",
      },
    ],
    questions: [
      {
        q: "J'ai payé en euros",
        r: "Choisissez la devise dans le formulaire. Le montant est converti au taux du jour et ce taux reste figé sur la note.",
      },
      {
        q: "Je ne peux plus modifier ma note",
        r: "Une note ne se modifie que tant qu'elle est « À valider ».",
      },
      {
        q: "Je ne vois que mes notes",
        r: "C'est normal : seuls le propriétaire et les responsables voient celles de toute l'équipe.",
      },
    ],
  },
  historique: {
    titre: "Historique (journal de compte)",
    resume:
      "Toutes les entrées et sorties d'argent, jour par jour : ventes, achats, dépenses, notes de frais, apports.",
    etapes: [
      {
        titre: "Choisir la période",
        texte: "« Ce mois », « Mois dernier »… ou vos propres dates « Du » / « Au ».",
      },
      { titre: "Filtrer", texte: "Cliquez sur un type pour le masquer ou l'afficher." },
    ],
    questions: [
      {
        q: "Que veut dire « hors solde » ?",
        r: "Une note de frais pas encore remboursée : l'argent n'est pas encore sorti, elle n'entre donc pas dans le solde.",
      },
    ],
  },
  rapports: {
    titre: "Bilan",
    resume: "Le bilan mois par mois : chiffre d'affaires, dépenses, bénéfice.",
  },
  statistiques: {
    titre: "Statistiques",
    resume: "Les produits qui se vendent le mieux et les performances de l'équipe.",
  },
  vendeurs: {
    titre: "Vendeurs",
    resume: "Ce que chaque personne a vendu et l'argent qu'elle détient encore.",
  },
  salaires: {
    titre: "Salaires",
    resume: "Fixer les salaires, suivre les avances et les versements.",
  },
  vue_equipe: {
    titre: "Vue d'ensemble",
    resume: "Ce que fait l'équipe aujourd'hui : tâches, rendez-vous, rappels.",
  },
  taches: {
    titre: "Tâches",
    resume: "La liste des choses à faire, pour vous ou pour un collègue.",
  },
  agenda: {
    titre: "Agenda",
    resume: "Les rendez-vous et événements de la boutique.",
  },
  rappels: {
    titre: "Rappels",
    resume: "Ce que l'application vous rappelle : échéances, relances, stock bas.",
  },
  settings: {
    titre: "Paramètres",
    resume:
      "Tous les réglages : votre compte d'abord, ceux de la boutique ensuite (réservés au propriétaire).",
    etapes: [
      {
        titre: "Réglages métier",
        texte: "Taux de commission, devise principale et devises secondaires, au même endroit.",
      },
      {
        titre: "Taux manuel ou automatique",
        texte:
          "Manuel : vous fixez la valeur. Automatique : le taux suit le marché deux fois par jour ; si le service est indisponible, le dernier taux connu est gardé.",
      },
      {
        titre: "Voir les prix en KMF, en euros…",
        texte:
          "Ajoutez la devise dans « Devises », puis choisissez-la dans « Prix dans les autres devises » : pour l'écran (caisse, produits, achats) et, séparément, pour chaque type de document comme la facture proforma.",
      },
      {
        titre: "Historique des taux",
        texte: "Chaque changement de taux est enregistré, avec sa date et son origine.",
      },
    ],
    questions: [
      {
        q: "Je veux voir tous mes montants en euros",
        r: "Ajoutez l'euro dans « Devises », puis choisissez-le dans « Afficher les montants en » : tout l'écran et les documents sont convertis au taux du jour. Vos montants restent enregistrés en ariary, et vous revenez à l'ariary d'un clic.",
      },
      {
        q: "Pourquoi la devise de tenue des comptes est « Verrouillée » ?",
        r: "Dès que la boutique a des ventes, des achats ou des produits, ses montants sont enregistrés dans cette devise. En changer ne ferait que changer le symbole de chiffres restés en ariary : on passe donc par la devise d'affichage.",
      },
      {
        q: "Dans quelle devise je saisis un prix ?",
        r: "Toujours dans la devise de tenue des comptes, indiquée à côté du champ. L'équivalent dans la devise d'affichage apparaît juste dessous.",
      },
    ],
  },
};

const mg: Dictionnaire = {};

const DICTIONNAIRES: Record<LangueAide, Dictionnaire> = { fr, mg };

export function ficheAide(ecran: string, langue: LangueAide = "fr"): FicheAide {
  return DICTIONNAIRES[langue][ecran] ?? fr[ecran] ?? fr.general;
}

export const LANGUES_AIDE: { cle: LangueAide; libelle: string; disponible: boolean }[] = [
  { cle: "fr", libelle: "Français", disponible: true },
  { cle: "mg", libelle: "Malagasy", disponible: Object.keys(mg).length > 0 },
];
