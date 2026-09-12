import type { ActiveTab, Sale, Purchase, Expense, CapitalApport, Product } from "../types";
import type { Database } from "./database.types";
import { getModuleScope, type PermissionsMap } from "./permissions";
import { dateDuJour } from "./dates";

type Devis = Database["public"]["Tables"]["quotes"]["Row"];
type Livraison = Database["public"]["Tables"]["deliveries"]["Row"];
type Commande = Database["public"]["Tables"]["orders"]["Row"];
type Client = Database["public"]["Tables"]["clients"]["Row"];
type Reglement = Database["public"]["Tables"]["payments"]["Row"];

export type TonNotif = "success" | "warning" | "danger" | "info" | "neutre";

export interface Notification {
  /** Stable d'un rendu à l'autre : c'est lui qui retient « déjà lu ». */
  id: string;
  /**
   * Une alerte décrit un ÉTAT qui dure — un stock bas le reste tant
   * qu'on ne réapprovisionne pas. Une activité décrit un ÉVÉNEMENT daté,
   * qui ne se reproduira plus. Les deux ne se lisent pas de la même
   * façon et ne se rangent donc pas ensemble.
   */
  genre: "alerte" | "activite";
  titre: string;
  detail: string;
  /** Date ISO ou AAAA-MM-JJ. Vide pour une alerte, qui n'a pas de date. */
  quand: string;
  ton: TonNotif;
  /** Écran ouvert au clic. */
  onglet?: ActiveTab;
}

/**
 * Ce qui s'est passé dans la boutique, et ce qui demande attention.
 *
 * ── Pourquoi aucune table ──
 *
 * Un journal de notifications se range d'ordinaire dans sa propre table,
 * écrite par des déclencheurs à chaque insertion. Ce n'est pas ce qui est
 * fait ici, et c'est délibéré : l'application charge déjà les ventes, les
 * achats, les dépenses, les apports, les règlements, les devis, les
 * livraisons, les commandes et les clients pour ses écrans. Tout est donc
 * en mémoire, avec sa date. Une table en double dirait la même chose une
 * seconde fois, et pourrait finir par dire autre chose — une ligne
 * corrigée ou supprimée laisserait derrière elle une notification qui ne
 * correspond plus à rien.
 *
 * Le prix de ce choix : rien n'est signalé qui ne soit déjà chargé, et
 * l'historique s'arrête où s'arrête celui des écrans.
 *
 * ── Ce que chacun voit ──
 *
 * `permissions` vaut `null` pour le propriétaire : il voit tout. Pour un
 * collaborateur, un type d'activité n'apparaît que si le module lui est
 * accordé ET que sa portée est « toute l'entreprise ». La portée par
 * défaut étant « ses propres données », un vendeur ne verra jamais
 * défiler ici les ventes de ses collègues. C'est volontairement plus
 * strict que la navigation, qui laisse certains onglets visibles en
 * adaptant leur contenu : un résumé ne sait pas s'adapter, il dit ou il
 * ne dit pas.
 */
export interface SourcesActivite {
  products: Product[];
  sales: Sale[];
  purchases: Purchase[];
  expenses: Expense[];
  apports: CapitalApport[];
  reglements: Reglement[];
  quotes: Devis[];
  deliveries: Livraison[];
  orders: Commande[];
  clients: Client[];
  tresorerie: number;
  seuilAlerteTresorerie: number;
  permissions: string[] | null;
  permissionsDetaillees: PermissionsMap | null;
  /** Réglage « Alertes de stock bas » (Paramètres → Notifications). */
  alertesStock: boolean;
  formatMontant: (montant: number) => string;
}

/** Combien d'événements on garde. Au-delà, on consulte l'écran dédié. */
const MAX_ACTIVITES = 60;

const pluriel = (n: number, mot: string, pluriel = `${mot}s`) => (n > 1 ? pluriel : mot);

/**
 * « Aujourd'hui », « Hier », puis la date. Un horodatage complet
 * n'apprend rien ici, et les ventes ou achats ne portent de toute façon
 * qu'un jour, sans heure.
 */
export function libelleQuand(quand: string, aujourdhui = dateDuJour()): string {
  if (!quand) return "";
  const jour = quand.slice(0, 10);
  if (jour === aujourdhui) return "Aujourd'hui";
  const [a, m, j] = aujourdhui.split("-").map(Number);
  const hier = new Date(a, m - 1, j - 1);
  const hierIso = `${hier.getFullYear()}-${String(hier.getMonth() + 1).padStart(2, "0")}-${String(
    hier.getDate(),
  ).padStart(2, "0")}`;
  if (jour === hierIso) return "Hier";
  const [aa, mm, jj] = jour.split("-");
  return `${jj}/${mm}/${aa}`;
}

export function construireNotifications(s: SourcesActivite): Notification[] {
  const { formatMontant: fmt } = s;
  const aujourdhui = dateDuJour();

  // Un module n'alimente le journal que s'il est accordé ET que la
  // portée accordée couvre toute l'entreprise. Voir le commentaire de
  // `SourcesActivite`.
  const peutVoir = (module: string): boolean => {
    if (s.permissions === null) return true;
    if (!s.permissions.includes(module)) return false;
    return getModuleScope(s.permissionsDetaillees ?? {}, module) === "all";
  };

  const alertes: Notification[] = [];
  const activites: Notification[] = [];

  // ─────────────── Ce qui demande attention ───────────────

  if (s.alertesStock && peutVoir("produits")) {
    const bas = s.products.filter((p) => p.stockActuel <= p.seuilAlerte);
    const rupture = bas.filter((p) => p.stockActuel <= 0);
    if (rupture.length > 0) {
      alertes.push({
        id: `alerte-rupture-${rupture.length}`,
        genre: "alerte",
        titre: `${rupture.length} ${pluriel(rupture.length, "produit")} en rupture`,
        detail: rupture
          .slice(0, 3)
          .map((p) => p.designation)
          .join(", "),
        quand: "",
        ton: "danger",
        onglet: "produits",
      });
    }
    const faibles = bas.filter((p) => p.stockActuel > 0);
    if (faibles.length > 0) {
      alertes.push({
        id: `alerte-stock-bas-${faibles.length}`,
        genre: "alerte",
        titre: `${faibles.length} ${pluriel(faibles.length, "produit")} sous le seuil`,
        detail: faibles
          .slice(0, 3)
          .map((p) => `${p.designation} (${p.stockActuel})`)
          .join(", "),
        quand: "",
        ton: "warning",
        onglet: "produits",
      });
    }
  }

  if (peutVoir("capital")) {
    if (s.tresorerie < 0) {
      alertes.push({
        id: "alerte-tresorerie-negative",
        genre: "alerte",
        titre: "Trésorerie négative",
        detail: `Solde actuel ${fmt(s.tresorerie)}.`,
        quand: "",
        ton: "danger",
        onglet: "capital",
      });
    } else if (s.tresorerie < s.seuilAlerteTresorerie) {
      alertes.push({
        id: "alerte-tresorerie-seuil",
        genre: "alerte",
        titre: "Trésorerie sous le seuil",
        detail: `${fmt(s.tresorerie)} — seuil fixé à ${fmt(s.seuilAlerteTresorerie)}.`,
        quand: "",
        ton: "warning",
        onglet: "capital",
      });
    }
  }

  if (peutVoir("ventes")) {
    const impayees = s.sales.filter((v) => v.soldeDu > 0);
    if (impayees.length > 0) {
      const du = impayees.reduce((t, v) => t + v.soldeDu, 0);
      alertes.push({
        id: `alerte-creances-${impayees.length}`,
        genre: "alerte",
        titre: `${fmt(du)} à encaisser`,
        detail: `${impayees.length} ${pluriel(impayees.length, "vente")} ${pluriel(impayees.length, "attend", "attendent")} son règlement.`,
        quand: "",
        ton: "warning",
        onglet: "paiements",
      });
    }
  }

  if (peutVoir("achats")) {
    const enRetard = s.purchases.filter(
      (a) => a.soldeDu > 0 && a.dateEcheance && a.dateEcheance < aujourdhui,
    );
    if (enRetard.length > 0) {
      const du = enRetard.reduce((t, a) => t + a.soldeDu, 0);
      alertes.push({
        id: `alerte-dettes-${enRetard.length}`,
        genre: "alerte",
        titre: `${fmt(du)} dû à vos fournisseurs`,
        detail: `${enRetard.length} ${pluriel(enRetard.length, "achat")} ${pluriel(enRetard.length, "a", "ont")} dépassé son échéance.`,
        quand: "",
        ton: "danger",
        onglet: "achats",
      });
    }
  }

  if (peutVoir("devis")) {
    const bientot = s.quotes.filter(
      (d) => d.statut === "envoye" && d.valide_jusqu_au && d.valide_jusqu_au >= aujourdhui,
    );
    const expires = s.quotes.filter(
      (d) => d.statut === "envoye" && d.valide_jusqu_au && d.valide_jusqu_au < aujourdhui,
    );
    if (expires.length > 0) {
      alertes.push({
        id: `alerte-devis-expires-${expires.length}`,
        genre: "alerte",
        titre: `${expires.length} ${pluriel(expires.length, "devis")} ${pluriel(expires.length, "expiré")}`,
        detail: "Sans réponse passé la date de validité.",
        quand: "",
        ton: "warning",
        onglet: "devis",
      });
    }
    if (bientot.length > 0) {
      alertes.push({
        id: `alerte-devis-attente-${bientot.length}`,
        genre: "alerte",
        titre: `${bientot.length} ${pluriel(bientot.length, "devis")} sans réponse`,
        detail: `${fmt(bientot.reduce((t, d) => t + (d.total ?? 0), 0))} proposés, en attente.`,
        quand: "",
        ton: "info",
        onglet: "devis",
      });
    }
  }

  if (peutVoir("livraisons")) {
    const chezLivreur = s.deliveries.filter(
      (l) => l.montant_encaisse > 0 && !l.argent_remis_le && l.statut === "livree",
    );
    if (chezLivreur.length > 0) {
      const total = chezLivreur.reduce((t, l) => t + l.montant_encaisse, 0);
      alertes.push({
        id: `alerte-argent-livreurs-${chezLivreur.length}`,
        genre: "alerte",
        titre: `${fmt(total)} chez vos livreurs`,
        detail: `${chezLivreur.length} ${pluriel(chezLivreur.length, "livraison")} ${pluriel(chezLivreur.length, "encaissée")}, argent pas encore rendu.`,
        quand: "",
        ton: "warning",
        onglet: "livraisons",
      });
    }
    const echouees = s.deliveries.filter((l) => l.statut === "echouee");
    if (echouees.length > 0) {
      alertes.push({
        id: `alerte-livraisons-echouees-${echouees.length}`,
        genre: "alerte",
        titre: `${echouees.length} ${pluriel(echouees.length, "livraison")} ${pluriel(echouees.length, "échouée")}`,
        detail: echouees[0].motif_echec ?? "Motif non précisé.",
        quand: "",
        ton: "danger",
        onglet: "livraisons",
      });
    }
  }

  // ─────────────── Ce qui s'est passé ───────────────

  if (peutVoir("ventes")) {
    // Les lignes passées ensemble au comptoir partagent un ticket : le
    // journal en fait une seule entrée, comme l'écran des ventes.
    const parTicket = new Map<string, Sale[]>();
    for (const v of s.sales)
      parTicket.set(v.ticketId || v.id, [...(parTicket.get(v.ticketId || v.id) ?? []), v]);
    for (const [cle, lignes] of parTicket) {
      const total = lignes.reduce((t, l) => t + l.totalVente, 0);
      const premiere = lignes[0];
      activites.push({
        id: `act-vente-${cle}`,
        genre: "activite",
        titre: `Vente ${fmt(total)}`,
        detail:
          lignes.length > 1
            ? `${lignes.length} articles · ${premiere.vendeur}`
            : `${premiere.designation} · ${premiere.vendeur}`,
        quand: premiere.date,
        ton: "success",
        onglet: "ventes",
      });
    }

    for (const r of s.reglements) {
      activites.push({
        id: `act-reglement-${r.id}`,
        genre: "activite",
        titre: `Règlement reçu ${fmt(r.montant)}`,
        detail: r.methode || "Encaissement",
        quand: r.created_at,
        ton: "success",
        onglet: "paiements",
      });
    }
  }

  if (peutVoir("achats")) {
    for (const a of s.purchases) {
      activites.push({
        id: `act-achat-${a.id}`,
        genre: "activite",
        titre: `Achat ${fmt(a.totalAchat)}`,
        detail: `${a.quantite} × ${a.designation}${a.fournisseur ? ` · ${a.fournisseur}` : ""}`,
        quand: a.date,
        ton: "info",
        onglet: "achats",
      });
    }
  }

  if (peutVoir("depenses")) {
    for (const d of s.expenses) {
      activites.push({
        id: `act-depense-${d.id}`,
        genre: "activite",
        titre: `Dépense ${fmt(d.montant)}`,
        detail: `${d.type}${d.note ? ` · ${d.note}` : ""}`,
        quand: d.date,
        ton: "warning",
        onglet: "depenses",
      });
    }
  }

  if (peutVoir("capital")) {
    for (const ap of s.apports) {
      activites.push({
        id: `act-apport-${ap.id}`,
        genre: "activite",
        titre: `Apport ${fmt(ap.montant)}`,
        detail: ap.source,
        quand: ap.date,
        ton: "success",
        onglet: "capital",
      });
    }
  }

  if (peutVoir("devis")) {
    for (const d of s.quotes) {
      const libelle =
        d.statut === "accepte"
          ? "Devis accepté"
          : d.statut === "refuse"
            ? "Devis refusé"
            : d.statut === "envoye"
              ? "Devis envoyé"
              : "Devis créé";
      activites.push({
        id: `act-devis-${d.id}-${d.statut}`,
        genre: "activite",
        titre: `${libelle} ${fmt(d.total ?? 0)}`,
        detail: `${d.numero ?? ""} · ${d.client_nom}`.replace(/^ · /, ""),
        quand: d.updated_at || d.created_at,
        ton: d.statut === "accepte" ? "success" : d.statut === "refuse" ? "danger" : "info",
        onglet: "devis",
      });
    }
  }

  if (peutVoir("livraisons")) {
    for (const l of s.deliveries) {
      const libelle =
        l.statut === "livree"
          ? "Livraison effectuée"
          : l.statut === "echouee"
            ? "Livraison échouée"
            : l.statut === "en_cours"
              ? "Livraison en cours"
              : "Livraison à faire";
      activites.push({
        id: `act-livraison-${l.id}-${l.statut}`,
        genre: "activite",
        titre: libelle,
        detail: `${l.destinataire} · ${l.adresse}`,
        quand: l.updated_at || l.created_at,
        ton: l.statut === "livree" ? "success" : l.statut === "echouee" ? "danger" : "neutre",
        onglet: "livraisons",
      });
    }
  }

  if (peutVoir("commandes")) {
    for (const c of s.orders) {
      activites.push({
        id: `act-commande-${c.id}-${c.statut_commande}`,
        genre: "activite",
        titre: `Commande ${fmt(c.montant_total)}`,
        detail: `${c.numero} · ${c.statut_commande}`,
        quand: c.updated_at || c.created_at,
        ton: "info",
        onglet: "commandes",
      });
    }
  }

  if (peutVoir("clients")) {
    for (const c of s.clients) {
      activites.push({
        id: `act-client-${c.id}`,
        genre: "activite",
        titre: "Nouveau client",
        detail: [c.prenom, c.nom].filter(Boolean).join(" ") || c.nom,
        quand: c.created_at,
        ton: "neutre",
        onglet: "clients",
      });
    }
  }

  // Les ventes, achats, dépenses et apports ne portent qu'un jour, sans
  // heure : à date égale, l'ordre d'identifiant les départage, ce qui
  // suit l'ordre d'enregistrement puisque les numéros sont attribués à
  // la suite par la base.
  activites.sort((a, b) => (a.quand < b.quand ? 1 : a.quand > b.quand ? -1 : a.id < b.id ? 1 : -1));

  return [...alertes, ...activites.slice(0, MAX_ACTIVITES)];
}
