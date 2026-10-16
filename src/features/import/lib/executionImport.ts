/**
 * Écriture d'un import dans les modules, avec les fonctions de la base.
 *
 *   fournisseurs  → insertion par lots de 100 (reprise ligne à ligne si un
 *                   lot est refusé) ; mise à jour des fiches existantes si
 *                   demandé. Les fournisseurs cités par des produits ou des
 *                   achats peuvent être créés au passage (par leur nom).
 *   produits      → RPC create_product, une ligne à la fois : chaque
 *                   création est atomique avec son mouvement de stock
 *                   initial ; clé d'idempotence boutique + import + ligne.
 *                   Existant : update_product (prix, seuil, fournisseur) et,
 *                   sur demande explicite, ajuster_stock pour aligner le
 *                   stock sur la quantité du fichier (mouvement journalisé).
 *   clients       → comme les fournisseurs.
 *   achats        → RPC add_purchase : achat + entrée en stock + règlement,
 *                   en une transaction ; produit retrouvé par son nom, ou
 *                   créé par l'achat lui-même.
 *
 * L'ordre (fournisseurs, produits, clients, achats) garantit que les
 * achats retrouvent les produits créés par le même import.
 *
 * Les droits sont ceux de l'utilisateur (RLS et contrôles des fonctions) :
 * l'import n'ouvre aucune porte que l'écran de saisie n'ouvre pas.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { cleDeListe } from "../../../lib/listes";
import type { CibleImport, LigneImport } from "./importDonnees";

export interface OptionsImport {
  /** Lignes qui recoupent un enregistrement existant. */
  doublons: "ignorer" | "mettre_a_jour";
  /** Produits existants : aligner le stock sur la quantité du fichier. */
  alignerStock: boolean;
  /** Produits et achats : créer les fournisseurs cités et inconnus. */
  creerFournisseurs: boolean;
}

export const OPTIONS_PAR_DEFAUT: OptionsImport = {
  doublons: "ignorer",
  alignerStock: false,
  creerFournisseurs: true,
};

export interface LotImport {
  cible: CibleImport;
  /** Nom de la feuille ou du tableau, pour le rapport. */
  source: string;
  lignes: LigneImport[];
  options: OptionsImport;
}

export interface ProduitExistant {
  id: string;
  designation: string;
  variante: string;
  prix_achat: number;
  prix_vente: number;
  fournisseur: string;
  seuil_alerte: number;
  stock_actuel: number;
}

export interface Existants {
  produits: ProduitExistant[];
  fournisseurs: { id: string; nom: string }[];
}

export interface BilanModule {
  module: CibleImport;
  ajoutes: number;
  mis_a_jour: number;
  ignores: number;
  rejetes: number;
}

export interface ErreurImport {
  module: CibleImport;
  source: string;
  ligne: number;
  message: string;
}

export interface RapportImport {
  bilans: BilanModule[];
  erreurs: ErreurImport[];
  interrompu: boolean;
}

export interface ContexteImport {
  client: Pick<SupabaseClient, "rpc" | "from">;
  storeId: string;
  userId: string;
  /** Empreinte de l'import entier : base des clés d'idempotence. */
  empreinte: string;
  nomFichier: string;
  existants: Existants;
  /** Appelé après chaque ligne traitée : (faites, total). */
  onProgres?: (faites: number, total: number) => void;
  /** Interruption demandée par l'utilisateur. */
  annule?: () => boolean;
}

const TAILLE_LOT = 100;
const ORDRE: CibleImport[] = ["fournisseurs", "produits", "clients", "achats"];

function messageErreur(e: { message?: string; code?: string } | null): string {
  if (!e) return "Erreur inconnue";
  if (e.code === "23505") return "Existe déjà";
  if (e.code === "42501") return "Droits insuffisants";
  return (e.message ?? "Erreur inconnue").slice(0, 200);
}

export const cleProduit = (designation: unknown, variante: unknown) =>
  `${cleDeListe(String(designation ?? ""))}|${cleDeListe(String(variante ?? ""))}`;

const nomAffiche = (designation: string, variante: string) =>
  variante ? `${designation} ${variante}` : designation;

function ligneTiers(cible: "clients" | "fournisseurs", l: LigneImport, ctx: ContexteImport) {
  const v = l.valeurs;
  const commun = {
    store_id: ctx.storeId,
    created_by: ctx.userId,
    nom: v.nom,
    entreprise: v.entreprise ?? null,
    telephone: v.telephone ?? null,
    email: v.email ?? null,
    adresse: v.adresse ?? null,
    ville: v.ville ?? null,
    note: v.note ?? null,
  };
  return cible === "clients" ? { ...commun, prenom: v.prenom ?? null } : commun;
}

/** Les seuls champs remplis par le fichier : une case vide n'efface rien. */
function correctifTiers(cible: "clients" | "fournisseurs", l: LigneImport) {
  const champs =
    cible === "clients"
      ? ["prenom", "entreprise", "telephone", "email", "adresse", "ville", "note"]
      : ["entreprise", "telephone", "email", "adresse", "ville", "note"];
  return Object.fromEntries(
    champs
      .filter((c) => l.valeurs[c] !== null && l.valeurs[c] !== "")
      .map((c) => [c, l.valeurs[c]]),
  );
}

export async function executerImport(
  lots: LotImport[],
  ctx: ContexteImport,
): Promise<RapportImport> {
  const bilans = new Map<CibleImport, BilanModule>();
  const bilan = (m: CibleImport) => {
    if (!bilans.has(m))
      bilans.set(m, { module: m, ajoutes: 0, mis_a_jour: 0, ignores: 0, rejetes: 0 });
    return bilans.get(m)!;
  };
  const erreurs: ErreurImport[] = [];
  const rejeter = (lot: LotImport, l: LigneImport, message: string) => {
    bilan(lot.cible).rejetes++;
    erreurs.push({ module: lot.cible, source: lot.source, ligne: l.numero, message });
  };

  const produits = new Map(
    ctx.existants.produits.map((p) => [cleProduit(p.designation, p.variante), p]),
  );
  const fournisseursConnus = new Set(ctx.existants.fournisseurs.map((f) => cleDeListe(f.nom)));
  const tries = [...lots].sort((a, b) => ORDRE.indexOf(a.cible) - ORDRE.indexOf(b.cible));

  const total = tries.reduce(
    (t, lot) =>
      t + lot.lignes.filter((l) => l.statut === "ok" || l.statut === "doublon_existant").length,
    0,
  );
  let faites = 0;
  const avancer = (n = 1) => ctx.onProgres?.((faites += n), total);
  let interrompu = false;

  // Les lignes ni créées ni mises à jour sont comptées d'emblée.
  for (const lot of tries) {
    for (const l of lot.lignes) {
      if (l.statut === "erreur") {
        bilan(lot.cible).rejetes++;
        erreurs.push({
          module: lot.cible,
          source: lot.source,
          ligne: l.numero,
          message: l.erreurs.join(" ; "),
        });
      } else if (l.statut === "doublon_fichier") bilan(lot.cible).ignores++;
      else if (
        l.statut === "doublon_existant" &&
        (lot.options.doublons === "ignorer" || lot.cible === "achats")
      ) {
        bilan(lot.cible).ignores++;
      }
    }
  }

  // ── 1. Fournisseurs du fichier, puis ceux cités par produits et achats ──
  async function insererTiers(
    cible: "clients" | "fournisseurs",
    lot: LotImport,
    lignes: LigneImport[],
  ) {
    const table = cible === "clients" ? "clients" : "suppliers";
    for (let i = 0; i < lignes.length; i += TAILLE_LOT) {
      if (ctx.annule?.()) {
        interrompu = true;
        return;
      }
      const paquet = lignes.slice(i, i + TAILLE_LOT);
      const { error } = await ctx.client
        .from(table)
        .insert(paquet.map((l) => ligneTiers(cible, l, ctx)));
      if (!error) {
        bilan(cible).ajoutes += paquet.length;
      } else {
        // Un lot refusé ne dit pas quelle ligne pose problème : reprise une à une.
        for (const l of paquet) {
          const { error: e } = await ctx.client.from(table).insert(ligneTiers(cible, l, ctx));
          if (e) rejeter(lot, l, messageErreur(e));
          else bilan(cible).ajoutes++;
        }
      }
      if (cible === "fournisseurs")
        for (const l of paquet) fournisseursConnus.add(cleDeListe(String(l.valeurs.nom)));
      avancer(paquet.length);
    }
  }

  async function mettreAJourTiers(
    cible: "clients" | "fournisseurs",
    lot: LotImport,
    lignes: LigneImport[],
  ) {
    const table = cible === "clients" ? "clients" : "suppliers";
    for (const l of lignes) {
      if (ctx.annule?.()) {
        interrompu = true;
        return;
      }
      const correctif = correctifTiers(cible, l);
      if (!l.existantId || Object.keys(correctif).length === 0) bilan(cible).ignores++;
      else {
        const { error } = await ctx.client.from(table).update(correctif).eq("id", l.existantId);
        if (error) rejeter(lot, l, messageErreur(error));
        else bilan(cible).mis_a_jour++;
      }
      avancer();
    }
  }

  for (const lot of tries) {
    if (interrompu) break;
    const aCreer = lot.lignes.filter((l) => l.statut === "ok");
    const aMettreAJour =
      lot.options.doublons === "mettre_a_jour" && lot.cible !== "achats"
        ? lot.lignes.filter((l) => l.statut === "doublon_existant")
        : [];

    if (lot.cible === "fournisseurs" || lot.cible === "clients") {
      await insererTiers(lot.cible, lot, aCreer);
      if (!interrompu) await mettreAJourTiers(lot.cible, lot, aMettreAJour);
      continue;
    }

    // Fournisseurs cités par des produits ou des achats, créés par leur nom.
    if (lot.options.creerFournisseurs) {
      const noms = new Map<string, string>();
      for (const l of [...aCreer, ...aMettreAJour]) {
        const nom = String(l.valeurs.fournisseur ?? "").trim();
        const cle = cleDeListe(nom);
        if (cle && !fournisseursConnus.has(cle) && !noms.has(cle)) noms.set(cle, nom);
      }
      if (noms.size > 0) {
        const { error } = await ctx.client.from("suppliers").insert(
          [...noms.values()].map((nom) => ({
            store_id: ctx.storeId,
            created_by: ctx.userId,
            nom,
          })),
        );
        if (!error) bilan("fournisseurs").ajoutes += noms.size;
        else {
          for (const nom of noms.values()) {
            const { error: e } = await ctx.client
              .from("suppliers")
              .insert({ store_id: ctx.storeId, created_by: ctx.userId, nom });
            if (!e) bilan("fournisseurs").ajoutes++;
            else if (e.code !== "23505") {
              bilan("fournisseurs").rejetes++;
              erreurs.push({
                module: "fournisseurs",
                source: lot.source,
                ligne: 0,
                message: `${nom} : ${messageErreur(e)}`,
              });
            }
          }
        }
        for (const cle of noms.keys()) fournisseursConnus.add(cle);
      }
    }

    if (lot.cible === "produits") {
      for (const l of aCreer) {
        if (ctx.annule?.()) {
          interrompu = true;
          break;
        }
        const v = l.valeurs;
        const designation = String(v.designation);
        const variante = (v.variante as string | null) ?? "";
        const { data, error } = await ctx.client.rpc("create_product", {
          p_store_id: ctx.storeId,
          p_designation: designation,
          p_prix_achat: (v.prix_achat as number | null) ?? 0,
          p_prix_vente_defaut: (v.prix_vente as number | null) ?? 0,
          p_fournisseur: (v.fournisseur as string | null) ?? "",
          p_stock_initial: (v.stock_initial as number | null) ?? 0,
          p_seuil_alerte: (v.seuil_alerte as number | null) ?? 0,
          p_variant_suffix: variante,
          p_display_name: nomAffiche(designation, variante),
          p_idempotency_key: `import:${ctx.storeId}:${ctx.empreinte}:${lot.source}:${l.numero}`,
        });
        if (error) rejeter(lot, l, messageErreur(error));
        else {
          bilan("produits").ajoutes++;
          const id = (data as { id?: string } | null)?.id;
          if (id) {
            produits.set(cleProduit(designation, variante), {
              id,
              designation,
              variante,
              prix_achat: (v.prix_achat as number | null) ?? 0,
              prix_vente: (v.prix_vente as number | null) ?? 0,
              fournisseur: (v.fournisseur as string | null) ?? "",
              seuil_alerte: (v.seuil_alerte as number | null) ?? 0,
              stock_actuel: (v.stock_initial as number | null) ?? 0,
            });
          }
        }
        avancer();
      }

      for (const l of aMettreAJour) {
        if (interrompu || ctx.annule?.()) {
          interrompu = true;
          break;
        }
        const existant = produits.get(cleProduit(l.valeurs.designation, l.valeurs.variante));
        if (!existant) {
          bilan("produits").ignores++;
          avancer();
          continue;
        }
        const v = l.valeurs;
        const nouveau = {
          prix_achat: (v.prix_achat as number | null) ?? existant.prix_achat,
          prix_vente: (v.prix_vente as number | null) ?? existant.prix_vente,
          fournisseur: (v.fournisseur as string | null) ?? existant.fournisseur,
          seuil_alerte: (v.seuil_alerte as number | null) ?? existant.seuil_alerte,
        };
        let change = false;
        let echec = false;
        if (
          nouveau.prix_achat !== existant.prix_achat ||
          nouveau.prix_vente !== existant.prix_vente ||
          nouveau.fournisseur !== existant.fournisseur ||
          nouveau.seuil_alerte !== existant.seuil_alerte
        ) {
          const { error } = await ctx.client.rpc("update_product", {
            p_product_id: existant.id,
            p_designation: existant.designation,
            p_prix_achat: nouveau.prix_achat,
            p_prix_vente_defaut: nouveau.prix_vente,
            p_fournisseur: nouveau.fournisseur,
            p_seuil_alerte: nouveau.seuil_alerte,
          });
          if (error) {
            rejeter(lot, l, messageErreur(error));
            echec = true;
          } else change = true;
        }
        // Le stock ne bouge que sur demande explicite, par un ajustement
        // d'inventaire journalisé — jamais par une écriture directe.
        const cible = v.stock_initial as number | null;
        if (
          !echec &&
          lot.options.alignerStock &&
          cible !== null &&
          cible !== existant.stock_actuel
        ) {
          const { error } = await ctx.client.rpc("ajuster_stock", {
            p_product_id: existant.id,
            p_delta: cible - existant.stock_actuel,
            p_note: `Inventaire importé (${ctx.nomFichier.slice(0, 80)})`,
          });
          if (error) {
            rejeter(lot, l, `Stock : ${messageErreur(error)}`);
            echec = true;
          } else change = true;
        }
        if (!echec) {
          if (change) bilan("produits").mis_a_jour++;
          else bilan("produits").ignores++;
        }
        avancer();
      }
      continue;
    }

    // ── Achats ──
    for (const l of aCreer) {
      if (ctx.annule?.()) {
        interrompu = true;
        break;
      }
      const v = l.valeurs;
      const designation = String(v.designation);
      const variante = (v.variante as string | null) ?? "";
      const prix = v.prix_achat as number;
      const connu = produits.get(cleProduit(designation, variante));
      const { data, error } = await ctx.client.rpc("add_purchase", {
        p_store_id: ctx.storeId,
        p_date: v.date,
        p_product_id: connu?.id ?? null,
        p_new_designation: designation,
        p_new_variant_suffix: variante,
        p_new_display_name: nomAffiche(designation, variante),
        // Même règle que la saisie d'un achat à l'écran.
        p_new_prix_vente_defaut: (v.prix_vente as number | null) ?? Math.round(prix * 1.3),
        p_new_seuil_alerte: 5,
        p_quantite: v.quantite,
        p_prix_achat_unit: prix,
        p_fournisseur: (v.fournisseur as string | null) ?? "",
        p_idempotency_key: `import:${ctx.storeId}:${ctx.empreinte}:${lot.source}:${l.numero}`,
        p_montant_paye: (v.montant_paye as number | null) ?? null,
        p_date_echeance: null,
      });
      if (error) rejeter(lot, l, messageErreur(error));
      else {
        bilan("achats").ajoutes++;
        const productId = (data as { product_id?: string } | null)?.product_id;
        if (!connu && productId) {
          bilan("produits").ajoutes++;
          produits.set(cleProduit(designation, variante), {
            id: productId,
            designation,
            variante,
            prix_achat: prix,
            prix_vente: (v.prix_vente as number | null) ?? Math.round(prix * 1.3),
            fournisseur: (v.fournisseur as string | null) ?? "",
            seuil_alerte: 5,
            stock_actuel: v.quantite as number,
          });
        }
      }
      avancer();
    }
  }

  return {
    bilans: ORDRE.filter((m) => bilans.has(m)).map((m) => bilans.get(m)!),
    erreurs,
    interrompu,
  };
}

// ─── Journal des imports (table imports_donnees) ─────────────────────

export async function ouvrirJournal(
  client: Pick<SupabaseClient, "from">,
  storeId: string,
  userId: string,
  nomFichier: string,
  source: "fichier" | "ia",
): Promise<string | null> {
  const { data, error } = await client
    .from("imports_donnees")
    .insert({
      store_id: storeId,
      user_id: userId,
      nom_fichier: nomFichier.slice(0, 200) || "fichier",
      source,
    })
    .select("id")
    .single();
  return error ? null : ((data as { id: string }).id ?? null);
}

export function statutDuRapport(r: RapportImport): "termine" | "partiel" | "echec" | "interrompu" {
  if (r.interrompu) return "interrompu";
  const faits = r.bilans.reduce((t, b) => t + b.ajoutes + b.mis_a_jour, 0);
  const rejetes = r.bilans.reduce((t, b) => t + b.rejetes, 0);
  if (faits === 0 && rejetes > 0) return "echec";
  return rejetes > 0 ? "partiel" : "termine";
}

export async function cloreJournal(
  client: Pick<SupabaseClient, "from">,
  id: string,
  rapport: RapportImport,
): Promise<void> {
  await client
    .from("imports_donnees")
    .update({
      statut: statutDuRapport(rapport),
      bilan: rapport.bilans,
      erreurs: rapport.erreurs.slice(0, 200),
      termine_le: new Date().toISOString(),
    })
    .eq("id", id);
}

export interface ImportJournalise {
  id: string;
  nom_fichier: string;
  source: "fichier" | "ia";
  statut: string;
  bilan: BilanModule[];
  erreurs: ErreurImport[];
  cree_le: string;
}

export async function listerImports(
  client: Pick<SupabaseClient, "from">,
  storeId: string,
): Promise<ImportJournalise[]> {
  const { data } = await client
    .from("imports_donnees")
    .select("id, nom_fichier, source, statut, bilan, erreurs, cree_le")
    .eq("store_id", storeId)
    .order("cree_le", { ascending: false })
    .limit(20);
  return (data as ImportJournalise[] | null) ?? [];
}
