import type { CapitalSummary, Expense, Product, Purchase, Sale, Seller } from "../../../types";
import { dateDuJour } from "../../../lib/dates";
import type { Intervalle, Periode } from "../hooks/useDashboardPeriod";
import { dansIntervalle, decalerJours, nombreDeJours } from "../hooks/useDashboardPeriod";
import type { MouvementStock } from "../hooks/useDashboardData";

/**
 * TOUS LES CHIFFRES DU TABLEAU DE BORD, ET D'OÙ ILS VIENNENT
 *
 * Fonctions pures : elles reçoivent ce que `useStoreData` a déjà chargé
 * et ne parlent jamais à la base. Un même jeu de données donne toujours
 * le même écran, et chaque chiffre se relit ici sans ouvrir de composant.
 *
 * AUCUN CALCUL MÉTIER N'EST REFAIT. Là où l'application sait déjà
 * compter, on reprend son résultat tel quel :
 *
 *   trésorerie      `capital.tresorerieGlobaleActuelle` (BalsamaApp.tsx)
 *   solde vendeur   `seller.soldeNetEnPoche` (BalsamaApp.tsx)
 *   à recommander   `stockActuel <= seuilAlerte` (ProduitsView, DashboardView)
 *   valeur du stock `Σ stockActuel × prixAchat` (DashboardView)
 *   marge           `Σ sale.margeTotale` (RapportsView)
 *
 * CE QUI EST NOUVEAU est signalé carte par carte : le bénéfice, la
 * découpe des créances à trente jours, la couverture en jours d'un
 * produit et les cumuls jour par jour. Rien de tout cela n'existait.
 *
 * LES JOURS SONT LOCAUX. Les colonnes `date` portent déjà un jour du
 * calendrier ; les horodatages (`payments.created_at`,
 * `stock_movements.created_at`) sont ramenés au jour local par
 * `dateDuJour`, jamais par `toISOString` — voir `src/lib/dates.ts`.
 */

/**
 * Les sources sont décrites par leur FORME, pas par leurs types
 * nominaux. `useStoreData` remet certaines tables telles que la base
 * les rend (`payments`, `orders`, `clients` : en minuscules avec des
 * traits bas) et d'autres traduites vers les types de `src/types.ts`
 * (`sales`, `purchases`…). Décrire ici les seuls champs lus évite de
 * s'attacher à ce partage-là, qui n'est pas notre affaire, et rend
 * visible ce que le tableau de bord touche vraiment.
 */
export interface SourcesChiffres {
  sales: Sale[];
  purchases: Purchase[];
  expenses: Expense[];
  products: Product[];
  /** Lignes brutes de `payments` : le seul horodatage est `created_at`. */
  payments: { montant: number; created_at: string }[];
  sellers: Seller[];
  capital: CapitalSummary;
  orders: { statut_commande: string; reste_a_payer: number | null; created_at: string }[];
  clients: { id: string; nom: string; created_at: string }[];
  quotes: { statut: string; total: number }[];
  deliveries: { statut: string; date_prevue?: string | null }[];
  taches: { statut: string; echeance: string | null }[];
  mouvements: MouvementStock[];
}

/* ═══════════════════════════════════════════════════════════════════
   Outils
   ═══════════════════════════════════════════════════════════════════ */

const somme = <T>(l: T[], f: (x: T) => number): number => l.reduce((a, x) => a + f(x), 0);

const dans = <T>(l: T[], jour: (x: T) => string, i: Intervalle): T[] =>
  l.filter((x) => dansIntervalle(jour(x), i));

/** Le jour local d'un horodatage. Jamais `toISOString`. */
export const jourDe = (instant: string): string => dateDuJour(new Date(instant));

/** Les jours d'un intervalle, du premier au dernier, sans trou. */
export function joursDe(i: Intervalle): string[] {
  const jours: string[] = [];
  for (let j = i.debut; j <= i.fin; j = decalerJours(j, 1)) {
    jours.push(j);
    if (jours.length > 400) break;
  }
  return jours;
}

/* ═══════════════════════════════════════════════════════════════════
   Ventes
   ═══════════════════════════════════════════════════════════════════ */

export interface ChiffresVentes {
  /** Σ `total_vente` sur la période. */
  total: number;
  /** Nombre de tickets distincts — une vente à trois lignes compte pour une. */
  tickets: number;
  /** Nombre de lignes. */
  lignes: number;
  /** Panier moyen par ticket. */
  panierMoyen: number;
  /** Σ `marge_totale` sur la période. */
  marge: number;
  /** Total de la période de comparaison. */
  totalPrecedent: number;
  /** Cumul jour par jour, dans l'ordre de `joursDe(intervalle)`. NOUVEAU. */
  cumul: { jour: string; duJour: number; cumule: number }[];
  /** Le même cumul sur la période précédente, pour la courbe en pointillé. */
  cumulPrecedent: { jour: string; cumule: number }[];
}

function cumulerParJour(ventes: Sale[], i: Intervalle) {
  const parJour = new Map<string, number>();
  for (const v of ventes) parJour.set(v.date, (parJour.get(v.date) ?? 0) + v.totalVente);
  let cumule = 0;
  return joursDe(i).map((jour) => {
    const duJour = parJour.get(jour) ?? 0;
    cumule += duJour;
    return { jour, duJour, cumule };
  });
}

export function chiffresVentes(s: SourcesChiffres, p: Periode): ChiffresVentes {
  const periode = dans(s.sales, (v) => v.date, p.intervalle);
  const precedentes = dans(s.sales, (v) => v.date, p.precedent);

  // Un ticket regroupe les lignes passées ensemble au comptoir. Les
  // ventes enregistrées avant l'étape des tickets n'en portent pas :
  // chacune compte alors pour elle-même.
  const tickets = new Set(periode.map((v) => v.ticketId ?? v.id)).size;
  const total = somme(periode, (v) => v.totalVente);

  return {
    total,
    tickets,
    lignes: periode.length,
    panierMoyen: tickets > 0 ? total / tickets : 0,
    marge: somme(periode, (v) => v.margeTotale),
    totalPrecedent: somme(precedentes, (v) => v.totalVente),
    cumul: cumulerParJour(periode, p.intervalle),
    cumulPrecedent: cumulerParJour(precedentes, p.precedent).map(({ jour, cumule }) => ({
      jour,
      cumule,
    })),
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Entrées et sorties d'argent
   ═══════════════════════════════════════════════════════════════════ */

export interface ChiffresFlux {
  /** Σ `payments.montant` encaissés sur la période. */
  encaisse: number;
  encaissePrecedent: number;
  /** Encaissements jour par jour, pour les mini-barres. NOUVEAU. */
  encaisseParJour: { jour: string; montant: number }[];
  achats: number;
  achatsPrecedent: number;
  depenses: number;
  depensesPrecedent: number;
  sorties: number;
  /** Ce que chaque personne a dépensé sur la période. */
  depensesParPersonne: { nom: string; montant: number }[];
  /** Moyenne des sorties par jour de la période. */
  sortiesParJour: number;
  /** Part des sorties dans les ventes de la période, en pourcentage. */
  partDesVentes: number;
}

export function chiffresFlux(s: SourcesChiffres, p: Periode, ventes: ChiffresVentes): ChiffresFlux {
  const paiementsPeriode = dans(s.payments, (r) => jourDe(r.created_at), p.intervalle);
  const achatsPeriode = dans(s.purchases, (a) => a.date, p.intervalle);
  const depensesPeriode = dans(s.expenses, (d) => d.date, p.intervalle);

  const achats = somme(achatsPeriode, (a) => a.totalAchat);
  const depenses = somme(depensesPeriode, (d) => d.montant);
  const sorties = achats + depenses;

  const parPersonne = new Map<string, number>();
  for (const d of depensesPeriode) {
    parPersonne.set(d.vendeur, (parPersonne.get(d.vendeur) ?? 0) + d.montant);
  }

  const parJour = new Map<string, number>();
  for (const r of paiementsPeriode) {
    const j = jourDe(r.created_at);
    parJour.set(j, (parJour.get(j) ?? 0) + r.montant);
  }

  const jours = Math.max(1, nombreDeJours(p.intervalle));

  return {
    encaisse: somme(paiementsPeriode, (r) => r.montant),
    encaissePrecedent: somme(
      dans(s.payments, (r) => jourDe(r.created_at), p.precedent),
      (r) => r.montant,
    ),
    encaisseParJour: joursDe(p.intervalle).map((jour) => ({
      jour,
      montant: parJour.get(jour) ?? 0,
    })),
    achats,
    achatsPrecedent: somme(
      dans(s.purchases, (a) => a.date, p.precedent),
      (a) => a.totalAchat,
    ),
    depenses,
    depensesPrecedent: somme(
      dans(s.expenses, (d) => d.date, p.precedent),
      (d) => d.montant,
    ),
    sorties,
    depensesParPersonne: [...parPersonne.entries()]
      .map(([nom, montant]) => ({ nom, montant }))
      .sort((a, b) => b.montant - a.montant),
    sortiesParJour: sorties / jours,
    partDesVentes: ventes.total > 0 ? (sorties / ventes.total) * 100 : 0,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Résultat — NOUVEAU
   ═══════════════════════════════════════════════════════════════════ */

export interface ChiffresResultat {
  marge: number;
  depenses: number;
  benefice: number;
  beneficePrecedent: number;
  /** Les achats de stock de la période, qui NE SONT PAS retirés. */
  achatsNonDeduits: number;
}

/**
 * Marge brute moins dépenses.
 *
 * La page Bilan calcule la marge, jamais le bénéfice : cette
 * soustraction-ci est nouvelle. Les achats de stock n'en sont pas
 * retirés — ils ne deviennent un coût qu'au moment où les produits se
 * vendent, et ce coût est déjà dans `marge_totale`, qui vaut
 * `total_vente − total_achat_ref`. Les soustraire une seconde fois
 * compterait deux fois la même marchandise.
 */
export function chiffresResultat(s: SourcesChiffres, p: Periode): ChiffresResultat {
  const marge = somme(
    dans(s.sales, (v) => v.date, p.intervalle),
    (v) => v.margeTotale,
  );
  const depenses = somme(
    dans(s.expenses, (d) => d.date, p.intervalle),
    (d) => d.montant,
  );
  const margePrecedente = somme(
    dans(s.sales, (v) => v.date, p.precedent),
    (v) => v.margeTotale,
  );
  const depensesPrecedentes = somme(
    dans(s.expenses, (d) => d.date, p.precedent),
    (d) => d.montant,
  );
  return {
    marge,
    depenses,
    benefice: marge - depenses,
    beneficePrecedent: margePrecedente - depensesPrecedentes,
    achatsNonDeduits: somme(
      dans(s.purchases, (a) => a.date, p.intervalle),
      (a) => a.totalAchat,
    ),
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Stock
   ═══════════════════════════════════════════════════════════════════ */

export interface LigneStock {
  id: string;
  nom: string;
  disponible: number;
  seuil: number;
  unite: string | null;
  /** Jours de couverture au rythme des trente derniers jours. NOUVEAU. */
  couverture: number | null;
  sousLeSeuil: boolean;
  enRupture: boolean;
}

export interface ChiffresStock {
  /** Valeur du stock : calcul existant, `Σ stockActuel × prixAchat`. */
  valeur: number;
  /** `stockActuel <= seuilAlerte` — la règle de la page Produits. */
  aRecommander: LigneStock[];
  enRupture: LigneStock[];
  /** Les plus proches du seuil, pour l'étagère. */
  etagere: LigneStock[];
  /** Entrées et sorties du jour, en unités. */
  entreesDuJour: number;
  sortiesDuJour: number;
  /** Entrées et sorties par jour sur la période. */
  parJour: { jour: string; entrees: number; sorties: number }[];
  /** Vrai quand `stock_movements` n'a pas pu être lue : on est en repli. */
  mouvementsEnRepli: boolean;
}

/**
 * La couverture d'un produit, en jours.
 *
 * Stock disponible divisé par la moyenne vendue par jour sur les trente
 * derniers jours. `null` quand le produit ne s'est pas vendu : diviser
 * par zéro donnerait l'infini, et « ∞ jours » sur un produit mort n'est
 * pas une information, c'est une absence d'information.
 *
 * Les produits de type `service` sont exclus : ils n'ont pas de stock.
 */
function couvertureEnJours(p: Product, ventes: Sale[], aujourdhui: string): number | null {
  const depuis = decalerJours(aujourdhui, -30);
  const vendues = ventes
    .filter((v) => v.productId === p.id && v.date >= depuis && v.date <= aujourdhui)
    .reduce((a, v) => a + v.quantite, 0);
  if (vendues <= 0) return null;
  return p.stockDisponible / (vendues / 30);
}

export function chiffresStock(
  s: SourcesChiffres,
  p: Periode,
  aujourdhui = dateDuJour(),
): ChiffresStock {
  const marchandises = s.products.filter((x) => x.typeProduit !== "service");

  const ligne = (x: Product): LigneStock => ({
    id: x.id,
    nom: x.designation,
    disponible: x.stockDisponible,
    seuil: x.seuilAlerte,
    unite: x.unite,
    couverture: couvertureEnJours(x, s.sales, aujourdhui),
    // Même règle que ProduitsView et l'ancien tableau de bord :
    // `stockActuel`, pas `stockDisponible`. Les deux diffèrent quand
    // des commandes ont réservé de la marchandise, et changer de
    // colonne ici ferait diverger deux écrans qui doivent s'accorder.
    sousLeSeuil: x.stockActuel <= x.seuilAlerte,
    enRupture: x.stockDisponible <= 0,
  });

  const lignes = marchandises.map(ligne);

  // Sans mouvements lisibles, on retombe sur les quantités des achats et
  // des ventes — moins fidèle (un inventaire corrigé n'y figure pas),
  // mais toujours vrai sur ce qui est entré et sorti par la caisse.
  const enRepli = s.mouvements.length === 0;

  const parJour = joursDe(p.intervalle).map((jour) => {
    if (!enRepli) {
      const dujour = s.mouvements.filter((m) => jourDe(m.created_at) === jour);
      return {
        jour,
        entrees: somme(
          dujour.filter((m) => m.stock_actuel_delta > 0),
          (m) => m.stock_actuel_delta,
        ),
        sorties: -somme(
          dujour.filter((m) => m.stock_actuel_delta < 0),
          (m) => m.stock_actuel_delta,
        ),
      };
    }
    return {
      jour,
      entrees: somme(
        s.purchases.filter((a) => a.date === jour),
        (a) => a.quantite,
      ),
      sorties: somme(
        s.sales.filter((v) => v.date === jour),
        (v) => v.quantite,
      ),
    };
  });

  const duJour = parJour.find((x) => x.jour === aujourdhui);

  return {
    valeur: somme(s.products, (x) => x.stockActuel * x.prixAchat),
    aRecommander: lignes.filter((x) => x.sousLeSeuil && !x.enRupture),
    enRupture: lignes.filter((x) => x.enRupture),
    etagere: [...lignes]
      .sort((a, b) => a.disponible / (a.seuil || 1) - b.disponible / (b.seuil || 1))
      .slice(0, 5),
    entreesDuJour: duJour?.entrees ?? 0,
    sortiesDuJour: duJour?.sorties ?? 0,
    parJour,
    mouvementsEnRepli: enRepli,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Paiements — la découpe à trente jours est NOUVELLE
   ═══════════════════════════════════════════════════════════════════ */

export interface ChiffresPaiements {
  encaisse: number;
  /** Solde dû de moins de trente jours. */
  aRecevoir: number;
  aRecevoirClients: number;
  /** Solde dû de plus de trente jours. */
  enRetard: number;
  enRetardClients: number;
  /** Encaissements par semaine de la période. */
  parSemaine: { libelle: string; montant: number }[];
}

export function chiffresPaiements(
  s: SourcesChiffres,
  p: Periode,
  flux: ChiffresFlux,
  aujourdhui = dateDuJour(),
): ChiffresPaiements {
  const limite = decalerJours(aujourdhui, -30);

  const impayees = s.sales.filter((v) => v.soldeDu > 0);
  const commandesDues = s.orders.filter((o) => (o.reste_a_payer ?? 0) > 0);

  const recents = impayees.filter((v) => v.date >= limite);
  const vieux = impayees.filter((v) => v.date < limite);
  const cmdRecentes = commandesDues.filter((o) => jourDe(o.created_at) >= limite);
  const cmdVieilles = commandesDues.filter((o) => jourDe(o.created_at) < limite);

  const clientsDe = (ventes: Sale[]) =>
    new Set(ventes.map((v) => v.clientId ?? v.clientCredit ?? v.id)).size;

  // Les semaines se comptent depuis le début de la période, par tranches
  // de sept jours : « semaine 1 » est celle du premier au septième jour,
  // et non la semaine civile, qui couperait la période en deux moitiés
  // inégales dont la première n'aurait parfois qu'un jour.
  const jours = joursDe(p.intervalle);
  const semaines: { libelle: string; montant: number }[] = [];
  for (let d = 0; d < jours.length; d += 7) {
    const tranche = jours.slice(d, d + 7);
    const montant = somme(
      flux.encaisseParJour.filter((x) => tranche.includes(x.jour)),
      (x) => x.montant,
    );
    const debut = Number(tranche[0].slice(8));
    const fin = Number(tranche[tranche.length - 1].slice(8));
    semaines.push({ libelle: debut === fin ? `${debut}` : `${debut}–${fin}`, montant });
  }

  return {
    encaisse: flux.encaisse,
    aRecevoir: somme(recents, (v) => v.soldeDu) + somme(cmdRecentes, (o) => o.reste_a_payer ?? 0),
    aRecevoirClients: clientsDe(recents) + cmdRecentes.length,
    enRetard: somme(vieux, (v) => v.soldeDu) + somme(cmdVieilles, (o) => o.reste_a_payer ?? 0),
    enRetardClients: clientsDe(vieux) + cmdVieilles.length,
    parSemaine: semaines,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Clients, commandes, fournisseurs, produits les plus vendus
   ═══════════════════════════════════════════════════════════════════ */

export interface ChiffresClients {
  nouveaux: number;
  actifs: number;
  aRelancer: { id: string | null; nom: string; du: number; depuis: number }[];
}

export function chiffresClients(
  s: SourcesChiffres,
  p: Periode,
  aujourdhui = dateDuJour(),
): ChiffresClients {
  const nouveaux = s.clients.filter((c) =>
    dansIntervalle(jourDe(c.created_at), p.intervalle),
  ).length;

  const ventesPeriode = dans(s.sales, (v) => v.date, p.intervalle);
  const actifs = new Set(ventesPeriode.map((v) => v.clientId ?? v.clientCredit).filter(Boolean))
    .size;

  const dus = new Map<
    string,
    { id: string | null; nom: string; du: number; plusVieille: string }
  >();
  for (const v of s.sales.filter((x) => x.soldeDu > 0)) {
    const nom = v.clientId
      ? (s.clients.find((c) => c.id === v.clientId)?.nom ?? v.clientCredit ?? "Client")
      : (v.clientCredit ?? "Client");
    const cle = v.clientId ?? nom;
    const deja = dus.get(cle);
    dus.set(cle, {
      id: v.clientId ?? null,
      nom,
      du: (deja?.du ?? 0) + v.soldeDu,
      plusVieille: deja && deja.plusVieille < v.date ? deja.plusVieille : v.date,
    });
  }

  const enJours = (jour: string) =>
    Math.max(0, Math.round((dateJour(aujourdhui) - dateJour(jour)) / 86400000));

  return {
    nouveaux,
    actifs,
    aRelancer: [...dus.values()]
      .map((c) => ({ id: c.id, nom: c.nom, du: c.du, depuis: enJours(c.plusVieille) }))
      .sort((a, b) => b.du - a.du),
  };
}

const dateJour = (jour: string): number => {
  const [a, m, j] = jour.split("-").map(Number);
  return new Date(a, (m ?? 1) - 1, j ?? 1).getTime();
};

export interface ChiffresCommandes {
  recues: number;
  enPreparation: number;
  enLivraison: number;
  aEncaisser: number;
  total: number;
}

export function chiffresCommandes(s: SourcesChiffres): ChiffresCommandes {
  const recues = s.orders.filter((o) => o.statut_commande === "en_attente").length;
  const enPreparation = s.orders.filter((o) => o.statut_commande === "en_cours").length;
  const enLivraison = s.deliveries.filter((d) => d.statut === "en_cours").length;
  const aEncaisser = s.orders.filter(
    (o) => (o.reste_a_payer ?? 0) > 0 && o.statut_commande !== "annulee",
  ).length;
  return {
    recues,
    enPreparation,
    enLivraison,
    aEncaisser,
    total: recues + enPreparation + enLivraison + aEncaisser,
  };
}

export interface ChiffresFournisseurs {
  /** Achats dont il reste quelque chose à payer. */
  aPayer: {
    nom: string;
    designation: string;
    du: number;
    echeance: string | null;
    retard: number;
  }[];
  totalDu: number;
  echeancesDepassees: number;
  /** Ce qui a été réglé aux fournisseurs pendant la période. */
  payeSurLaPeriode: number;
}

export function chiffresFournisseurs(
  s: SourcesChiffres,
  p: Periode,
  paiementsFournisseurs: { date: string; montant: number }[],
  aujourdhui = dateDuJour(),
): ChiffresFournisseurs {
  const impayes = s.purchases.filter((a) => (a.soldeDu ?? 0) > 0);
  const aPayer = impayes
    .map((a) => ({
      nom: a.fournisseur,
      designation: a.designation,
      du: a.soldeDu ?? 0,
      echeance: a.dateEcheance,
      retard:
        a.dateEcheance && a.dateEcheance < aujourdhui
          ? Math.round((dateJour(aujourdhui) - dateJour(a.dateEcheance)) / 86400000)
          : 0,
    }))
    .sort((x, y) => y.retard - x.retard || y.du - x.du);

  return {
    aPayer,
    totalDu: somme(aPayer, (x) => x.du),
    echeancesDepassees: aPayer.filter((x) => x.retard > 0).length,
    payeSurLaPeriode: somme(
      dans(paiementsFournisseurs, (r) => r.date, p.intervalle),
      (r) => r.montant,
    ),
  };
}

export interface ProduitVendu {
  id: string;
  nom: string;
  montant: number;
  quantite: number;
  unite: string | null;
  /** Part dans les ventes de la période, en pourcentage. */
  part: number;
}

export function topProduits(s: SourcesChiffres, p: Periode, combien = 5): ProduitVendu[] {
  const ventes = dans(s.sales, (v) => v.date, p.intervalle);
  const total = somme(ventes, (v) => v.totalVente);
  const parProduit = new Map<string, { nom: string; montant: number; quantite: number }>();
  for (const v of ventes) {
    const cle = v.productId || v.designation;
    const deja = parProduit.get(cle);
    parProduit.set(cle, {
      nom: v.designation,
      montant: (deja?.montant ?? 0) + v.totalVente,
      quantite: (deja?.quantite ?? 0) + v.quantite,
    });
  }
  return [...parProduit.entries()]
    .map(([id, x]) => ({
      id,
      nom: x.nom,
      montant: x.montant,
      quantite: x.quantite,
      unite: s.products.find((pr) => pr.id === id)?.unite ?? null,
      part: total > 0 ? (x.montant / total) * 100 : 0,
    }))
    .sort((a, b) => b.montant - a.montant)
    .slice(0, combien);
}

/* ═══════════════════════════════════════════════════════════════════
   Points d'attention
   ═══════════════════════════════════════════════════════════════════ */

export interface PointsDAttention {
  tachesEnRetard: number;
  produitsARecommander: number;
  devisSansReponse: number;
  total: number;
}

export function pointsDAttention(
  s: SourcesChiffres,
  stock: ChiffresStock,
  aujourdhui = dateDuJour(),
): PointsDAttention {
  const tachesEnRetard = s.taches.filter(
    (t) => t.statut !== "termine" && t.echeance !== null && t.echeance < aujourdhui,
  ).length;
  const devisSansReponse = s.quotes.filter(
    (q) => q.statut === "brouillon" || q.statut === "envoye",
  ).length;
  const produitsARecommander = stock.aRecommander.length + stock.enRupture.length;
  return {
    tachesEnRetard,
    produitsARecommander,
    devisSansReponse,
    total: tachesEnRetard + produitsARecommander + devisSansReponse,
  };
}
