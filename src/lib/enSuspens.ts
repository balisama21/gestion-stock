import { dateDuJour } from "./dates";
import { estExpire } from "./devis";

/**
 * Ce qui attend une décision, un geste ou un encaissement.
 *
 * ── Pourquoi une ligne par NATURE et non par élément ──
 *
 * C'est ce qui empêche le bloc de déborder. « 3 ventes à encaisser » est
 * une ligne, pas trois ; le jour où il y en a quarante, c'est toujours
 * une ligne. Un tableau de bord qui grandit avec l'activité devient
 * illisible exactement le jour où l'activité mérite d'être lue.
 *
 * Le nombre maximum de lignes est donc fixe : autant que de natures, et
 * pas une de plus.
 *
 * ── Pourquoi trois rangs et non un tri par montant ──
 *
 * Une tâche en retard de trois semaines passe avant un devis envoyé ce
 * matin, même s'il pèse cent fois plus. L'urgence ne se mesure pas en
 * ariary : elle se mesure à qui attend, et depuis combien de temps.
 *
 *   rang 0 — quelqu'un attend après vous, et le sait
 *   rang 1 — en cours, dans les temps
 *   rang 2 — des soldes ouverts, sans échéance
 *
 * À rang égal, le montant décide : entre deux choses aussi urgentes, la
 * plus grosse passe devant.
 *
 * ── Une nature ne se dédouble jamais ──
 *
 * « Ce que vous devez » ne se coupe pas en deux lignes « en retard » et
 * « à jour » : le même argent apparaîtrait deux fois et les totaux ne
 * s'additionneraient plus. C'est la LIGNE ENTIÈRE qui monte au rang 0
 * dès qu'une partie est en retard, et son détail le dit.
 */

export type RangSuspens = 0 | 1 | 2;

export interface LigneSuspens {
  cle: string;
  libelle: string;
  detail: string;
  /**
   * La part du détail qui dit le retard, à colorer.
   *
   * Pas de badge : il répéterait mot pour mot ce que le détail énonce
   * déjà — « dont 1 en retard » suivi d'une pastille « En retard ». Et
   * cinq pastilles sur sept lignes, plus aucune ne se remarque. On
   * colore donc les mots eux-mêmes, comme le fait déjà l'indication
   * secondaire d'une colonne d'indicateurs.
   */
  alerte?: string;
  /**
   * Nul quand la nature n'a pas de montant — une tâche en retard ne se
   * chiffre pas, et afficher « 0 Ar » à sa droite serait un mensonge.
   */
  montant: number | null;
  rang: RangSuspens;
  onglet: string;
}

export interface SourcesSuspens {
  sales: { soldeDu: number }[];
  purchases: { soldeDu: number; dateEcheance: string | null }[];
  deliveries: { statut: string; montant_encaisse: number; argent_remis_le: string | null }[];
  quotes: { statut: string; total: number; valide_jusqu_au: string | null }[];
  orders: {
    statut_commande: string;
    montant_total: number;
    date_livraison: string | null;
  }[];
  taches: { statut: string; echeance: string | null }[];
  /** Les demandes d'avance sur salaire qui attendent une décision. */
  avancesEnAttente: { montant: number }[];
  /** Vrai si la boutique a retiré ce module de sa navigation. */
  masque: (cle: string) => boolean;
  aujourdhui?: string;
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

export function construireEnSuspens(s: SourcesSuspens): LigneSuspens[] {
  const aujourdhui = s.aujourdhui ?? dateDuJour();
  const maintenant = new Date(`${aujourdhui}T12:00:00`);
  const lignes: LigneSuspens[] = [];

  // ── Rang 0 : quelqu'un attend après vous ──

  // Une demande d'avance bloque quelqu'un tant que personne ne tranche,
  // et cette personne, elle, le sait : elle a fait la demande.
  if (s.avancesEnAttente.length > 0 && !s.masque("salaires")) {
    lignes.push({
      cle: "avances",
      libelle: "Avances à décider",
      detail: pluriel(s.avancesEnAttente.length, "demande"),
      alerte: "en attente de votre décision",
      montant: s.avancesEnAttente.reduce((n, a) => n + a.montant, 0),
      rang: 0,
      onglet: "salaires",
    });
  }

  const tachesEnRetard = s.taches.filter(
    (t) => t.statut !== "termine" && !!t.echeance && t.echeance < aujourdhui,
  );
  if (tachesEnRetard.length > 0 && !s.masque("taches")) {
    lignes.push({
      cle: "taches",
      libelle: "Tâches en retard",
      detail: "",
      alerte: `${pluriel(tachesEnRetard.length, "échéance")} dépassée${tachesEnRetard.length > 1 ? "s" : ""}`,
      montant: null,
      rang: 0,
      onglet: "taches",
    });
  }

  // ── Natures dont le rang dépend de l'état ──

  const impayesFournisseurs = s.purchases.filter((a) => a.soldeDu > 0);
  const duAuxFournisseurs = impayesFournisseurs.reduce((n, a) => n + a.soldeDu, 0);
  if (duAuxFournisseurs > 0 && !s.masque("fournisseurs")) {
    const enRetard = impayesFournisseurs.filter(
      (a) => !!a.dateEcheance && a.dateEcheance < aujourdhui,
    ).length;
    lignes.push({
      cle: "fournisseurs",
      libelle: "Ce que vous devez",
      detail: `${pluriel(impayesFournisseurs.length, "achat")} à régler`,
      ...(enRetard > 0 ? { alerte: `dont ${enRetard} en retard` } : {}),
      montant: duAuxFournisseurs,
      rang: enRetard > 0 ? 0 : 2,
      onglet: "fournisseurs",
    });
  }

  const devisEnAttente = s.quotes.filter((d) => d.statut === "brouillon" || d.statut === "envoye");
  if (devisEnAttente.length > 0 && !s.masque("devis")) {
    const expires = devisEnAttente.filter((d) => estExpire(d, maintenant)).length;
    lignes.push({
      cle: "devis",
      libelle: "Devis sans réponse",
      detail: `${devisEnAttente.length} en attente`,
      ...(expires > 0 ? { alerte: `dont ${expires} expiré${expires > 1 ? "s" : ""}` } : {}),
      montant: devisEnAttente.reduce((n, d) => n + d.total, 0),
      rang: expires > 0 ? 0 : 1,
      onglet: "devis",
    });
  }

  const aPreparer = s.orders.filter(
    (o) => o.statut_commande === "en_attente" || o.statut_commande === "en_cours",
  );
  if (aPreparer.length > 0 && !s.masque("commandes")) {
    const enRetard = aPreparer.filter(
      (o) => !!o.date_livraison && o.date_livraison < aujourdhui,
    ).length;
    lignes.push({
      cle: "commandes",
      libelle: "Commandes à préparer",
      detail: `${aPreparer.length} en cours`,
      ...(enRetard > 0 ? { alerte: `dont ${enRetard} en retard` } : {}),
      montant: aPreparer.reduce((n, o) => n + o.montant_total, 0),
      rang: enRetard > 0 ? 0 : 1,
      onglet: "commandes",
    });
  }

  // ── Rang 2 : des soldes ouverts, sans échéance ──
  //
  // Une vente à crédit ne porte pas de date d'échéance en base : on ne
  // peut donc pas dire qu'elle est « en retard », seulement qu'elle
  // n'est pas rentrée. Inventer une urgence qu'aucune donnée ne soutient
  // ferait clignoter ce bloc pour rien.

  const impayesClients = s.sales.filter((v) => v.soldeDu > 0);
  const duParLesClients = impayesClients.reduce((n, v) => n + v.soldeDu, 0);
  if (duParLesClients > 0) {
    lignes.push({
      cle: "clients",
      libelle: "Ce qu'on vous doit",
      detail: `${pluriel(impayesClients.length, "vente")} à encaisser`,
      montant: duParLesClients,
      rang: 2,
      onglet: "paiements",
    });
  }

  const chezLesLivreurs = s.deliveries
    .filter((l) => l.statut === "livree" && l.montant_encaisse > 0 && !l.argent_remis_le)
    .reduce((n, l) => n + l.montant_encaisse, 0);
  if (chezLesLivreurs > 0 && !s.masque("livraisons")) {
    lignes.push({
      cle: "livreurs",
      libelle: "Chez les livreurs",
      detail: "encaissé, pas encore rendu",
      montant: chezLesLivreurs,
      rang: 2,
      onglet: "livraisons",
    });
  }

  // Le rang d'abord, le montant ensuite. Une ligne sans montant passe
  // après celles qui en portent un, à rang égal : elle ne se compare pas.
  return lignes.sort((a, b) => {
    if (a.rang !== b.rang) return a.rang - b.rang;
    return (b.montant ?? -1) - (a.montant ?? -1);
  });
}
