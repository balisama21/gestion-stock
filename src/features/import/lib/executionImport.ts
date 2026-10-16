/**
 * Écriture d'un import, par lots, avec les fonctions de la base.
 *
 *   produits      → RPC create_product, une ligne à la fois : chaque
 *                   création est atomique avec son mouvement de stock
 *                   initial ; la clé d'idempotence (boutique + empreinte
 *                   de l'import + numéro de ligne) rend la reprise sûre.
 *   clients,
 *   fournisseurs  → insertion par lots de 100 ; si un lot est refusé, ses
 *                   lignes sont reprises une à une pour situer l'erreur.
 *
 * Les droits sont ceux de l'utilisateur (RLS et contrôles des fonctions) :
 * l'import n'ouvre aucune porte que l'écran de saisie n'ouvre pas.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CibleImport, LigneImport } from "./importDonnees";

export interface RapportImport {
  crees: number;
  ignores: number;
  erreurs: { numero: number; message: string }[];
}

export interface ContexteImport {
  client: Pick<SupabaseClient, "rpc" | "from">;
  storeId: string;
  userId: string;
  empreinte: string;
  /** Appelé après chaque ligne traitée : (faites, total). */
  onProgres?: (faites: number, total: number) => void;
  /** Interruption demandée par l'utilisateur. */
  annule?: () => boolean;
}

const TAILLE_LOT = 100;

function messageErreur(e: { message?: string; code?: string } | null): string {
  if (!e) return "Erreur inconnue";
  if (e.code === "23505") return "Existe déjà";
  if (e.code === "42501") return "Droits insuffisants";
  return (e.message ?? "Erreur inconnue").slice(0, 200);
}

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

export async function executerImport(
  cible: CibleImport,
  lignes: LigneImport[],
  ctx: ContexteImport,
): Promise<RapportImport> {
  const aImporter = lignes.filter((l) => l.statut === "ok");
  const rapport: RapportImport = {
    crees: 0,
    ignores: lignes.length - aImporter.length,
    erreurs: [],
  };
  let faites = 0;

  if (cible === "produits") {
    for (const l of aImporter) {
      if (ctx.annule?.()) break;
      const v = l.valeurs;
      const variante = (v.variante as string | null) ?? "";
      const designation = String(v.designation);
      const { error } = await ctx.client.rpc("create_product", {
        p_store_id: ctx.storeId,
        p_designation: designation,
        p_prix_achat: (v.prix_achat as number | null) ?? 0,
        p_prix_vente_defaut: (v.prix_vente as number | null) ?? 0,
        p_fournisseur: (v.fournisseur as string | null) ?? "",
        p_stock_initial: (v.stock_initial as number | null) ?? 0,
        p_seuil_alerte: (v.seuil_alerte as number | null) ?? 0,
        p_variant_suffix: variante,
        p_display_name: variante ? `${designation} ${variante}` : designation,
        p_idempotency_key: `import:${ctx.storeId}:${ctx.empreinte}:${l.numero}`,
      });
      if (error) rapport.erreurs.push({ numero: l.numero, message: messageErreur(error) });
      else rapport.crees++;
      ctx.onProgres?.(++faites, aImporter.length);
    }
    return rapport;
  }

  const table = cible === "clients" ? "clients" : "suppliers";
  for (let i = 0; i < aImporter.length; i += TAILLE_LOT) {
    if (ctx.annule?.()) break;
    const lot = aImporter.slice(i, i + TAILLE_LOT);
    const { error } = await ctx.client
      .from(table)
      .insert(lot.map((l) => ligneTiers(cible, l, ctx)));
    if (!error) {
      rapport.crees += lot.length;
    } else {
      // Un lot refusé ne dit pas quelle ligne pose problème : reprise une à une.
      for (const l of lot) {
        const { error: e } = await ctx.client.from(table).insert(ligneTiers(cible, l, ctx));
        if (e) rapport.erreurs.push({ numero: l.numero, message: messageErreur(e) });
        else rapport.crees++;
      }
    }
    faites += lot.length;
    ctx.onProgres?.(faites, aImporter.length);
  }
  return rapport;
}
