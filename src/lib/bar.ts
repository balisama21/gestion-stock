/**
 * LE BAR-KARAOKÉ : TABLES, NOTES OUVERTES, ADDITIONS
 *
 * Une note est l'addition en cours d'une table. On y ajoute les
 * consommations au fil de la soirée ; à l'encaissement, la base les
 * change en ventes ordinaires (`encaisser_note_bar`), et c'est à ce
 * moment-là que le stock sort. Le droit de table est une ligne sans
 * produit, ajoutée à l'ouverture.
 *
 * Ce fichier ne parle pas à la base : il calcule. Les écrans et le hook
 * `useBar` s'en servent pour que l'addition affichée soit exactement
 * celle que la base encaissera.
 */

export interface ZoneBar {
  id: string;
  store_id: string;
  nom: string;
  droit_table: number;
  ordre: number;
}

export interface TableBar {
  id: string;
  store_id: string;
  zone_id: string | null;
  numero: string;
  places: number | null;
  /** `null` : le droit de table de sa zone. */
  droit_table: number | null;
  active: boolean;
  ordre: number;
}

export type StatutNote = "ouverte" | "encaissee" | "annulee";

export interface NoteBar {
  id: string;
  store_id: string;
  table_id: string;
  statut: StatutNote;
  client_id: string | null;
  nb_personnes: number | null;
  ouverte_par: string | null;
  ouverte_le: string;
  fermee_le: string | null;
}

export interface LigneNote {
  id: string;
  store_id: string;
  note_id: string;
  product_id: string | null;
  designation: string;
  genre: "article" | "droit_table";
  quantite: number;
  prix_unit: number;
  offert: boolean;
  serveur: string | null;
  annulee: boolean;
  motif: string | null;
  sale_id: string | null;
  cree_le: string;
}

/**
 * Le nom d'une table à l'écran : « Table 4 », « Table V2 »… mais une
 * table déjà nommée « Table4 », « Comptoir » ou « Terrasse 1 » garde son
 * nom tel quel, sans « Table Table4 ».
 */
export const nomDeTable = (numero: string | null | undefined): string => {
  const n = (numero ?? "").trim();
  if (!n) return "Table";
  return /^[a-z]?\d+$/i.test(n) ? `Table ${n}` : n;
};

/** Ce qu'une table paie pour s'asseoir : le sien, sinon celui de sa zone. */
export function droitDeTable(table: TableBar, zones: ZoneBar[]): number {
  if (table.droit_table !== null && table.droit_table !== undefined) return table.droit_table;
  return zones.find((z) => z.id === table.zone_id)?.droit_table ?? 0;
}

/** Le montant d'une ligne, tel qu'il sera encaissé. Offerte ou annulée : 0. */
export const montantLigne = (l: LigneNote): number =>
  l.annulee || l.offert ? 0 : l.quantite * l.prix_unit;

/** Une ligne qui reste à payer. */
export const resteAPayer = (l: LigneNote): boolean => !l.annulee && l.sale_id === null;

export interface TotalNote {
  /** Tout ce qui a été servi et n'est pas annulé, offerts à 0. */
  total: number;
  /** Ce qui a déjà été encaissé (addition partagée). */
  dejaPaye: number;
  /** Ce qui reste à encaisser. */
  reste: number;
  /** La valeur des offerts, au prix de la carte : ce que la maison a donné. */
  offerts: number;
  /** Le nombre d'articles servis, droit de table exclu. */
  articles: number;
}

export function totalNote(lignes: LigneNote[]): TotalNote {
  let total = 0;
  let dejaPaye = 0;
  let offerts = 0;
  let articles = 0;
  for (const l of lignes) {
    if (l.annulee) continue;
    const m = montantLigne(l);
    total += m;
    if (l.sale_id) dejaPaye += m;
    if (l.offert) offerts += l.quantite * l.prix_unit;
    if (l.genre === "article") articles += l.quantite;
  }
  return { total, dejaPaye, reste: total - dejaPaye, offerts, articles };
}

/** Le total des lignes choisies pour une addition partagée. */
export const totalDesLignes = (lignes: LigneNote[], ids: Set<string>): number =>
  lignes.filter((l) => ids.has(l.id) && resteAPayer(l)).reduce((n, l) => n + montantLigne(l), 0);

/**
 * Les lignes regroupées pour l'affichage : « 6 × THB » plutôt que six
 * lignes « 1 × THB ». Même produit, même prix, même offert, même état.
 * Le regroupement suit l'ordre du premier service.
 */
export interface GroupeLignes {
  cle: string;
  designation: string;
  product_id: string | null;
  genre: LigneNote["genre"];
  prix_unit: number;
  offert: boolean;
  payee: boolean;
  quantite: number;
  montant: number;
  lignes: LigneNote[];
}

export function grouperLignes(lignes: LigneNote[]): GroupeLignes[] {
  const groupes = new Map<string, GroupeLignes>();
  for (const l of [...lignes].sort((a, b) => a.cree_le.localeCompare(b.cree_le))) {
    if (l.annulee) continue;
    const payee = l.sale_id !== null;
    const cle = [l.product_id ?? `~${l.designation}`, l.prix_unit, l.offert, payee].join("|");
    const g = groupes.get(cle);
    if (g) {
      g.quantite += l.quantite;
      g.montant += montantLigne(l);
      g.lignes.push(l);
    } else {
      groupes.set(cle, {
        cle,
        designation: l.designation,
        product_id: l.product_id,
        genre: l.genre,
        prix_unit: l.prix_unit,
        offert: l.offert,
        payee,
        quantite: l.quantite,
        montant: montantLigne(l),
        lignes: [l],
      });
    }
  }
  return [...groupes.values()];
}

/** Depuis combien de temps la table est occupée : « 2 h 05 », « 12 min ». */
export function dureeDepuis(debutIso: string, maintenant: number = Date.now()): string {
  const minutes = Math.max(0, Math.floor((maintenant - new Date(debutIso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  return `${h} h ${String(minutes % 60).padStart(2, "0")}`;
}

/** Les tables rangées par zone, dans l'ordre choisi ; les tables sans zone à la fin. */
export function tablesParZone(
  tables: TableBar[],
  zones: ZoneBar[],
): { zone: ZoneBar | null; tables: TableBar[] }[] {
  const tri = (a: TableBar, b: TableBar) =>
    a.ordre - b.ordre || a.numero.localeCompare(b.numero, "fr", { numeric: true });
  const actives = tables.filter((t) => t.active);
  const sortie: { zone: ZoneBar | null; tables: TableBar[] }[] = [...zones]
    .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, "fr"))
    .map((zone) => ({ zone, tables: actives.filter((t) => t.zone_id === zone.id).sort(tri) }))
    .filter((g) => g.tables.length > 0);
  const sansZone = actives
    .filter((t) => !t.zone_id || !zones.some((z) => z.id === t.zone_id))
    .sort(tri);
  if (sansZone.length > 0) sortie.push({ zone: null, tables: sansZone });
  return sortie;
}
