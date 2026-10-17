// Fonction edge « ia » : seule porte d'entrée vers le fournisseur d'IA.
//
// Secrets (côté serveur uniquement, jamais dans le navigateur ni dans Git) :
//   OPENAI_API_KEY      clé du fournisseur — absente = IA non configurée
//   IA_COUPE_CIRCUIT    "1" coupe immédiatement toute requête IA
// Fournis par Supabase : SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
//
// Corps attendu :
//   { "action": "etat" }                          → la clé est-elle configurée ?
//   { "action": "executer", "store_id", "entree" } → voir noyau.ts
//
// Aucun fichier n'est écrit : les documents sont traités en mémoire, puis
// oubliés. Le journal ne garde que des compteurs (jetons, coût, statut).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type CandidatReappro,
  type Dependances,
  type Fonctionnalite,
  fournisseurOpenAI,
  refus,
  traiter,
  validerDemande,
} from "./noyau.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TAILLE_MAX_CORPS = 30 * 1024 * 1024;

function json(corps: unknown, status = 200): Response {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function nombre(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(refus("requete_invalide"), 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cle = Deno.env.get("OPENAI_API_KEY")?.trim() || "";
  const coupe = Deno.env.get("IA_COUPE_CIRCUIT") === "1";

  // ── Identité ──
  const authHeader = req.headers.get("Authorization") ?? "";
  const jeton = authHeader.replace(/^Bearer\s+/i, "");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: auth } = jeton ? await admin.auth.getUser(jeton) : { data: { user: null } };
  const user = auth?.user;
  if (!user) return json(refus("non_authentifie"), 401);

  // ── Corps ──
  const longueur = Number(req.headers.get("content-length") ?? "0");
  if (longueur > TAILLE_MAX_CORPS) return json(refus("entree_trop_grande"), 413);
  const corps = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!corps) return json(refus("requete_invalide"), 400);

  if (corps.action === "etat") {
    // Jamais la clé elle-même : seulement sa présence.
    return json({ ok: true, cle_configuree: cle.length > 0, coupe, fournisseur: "openai" });
  }
  if (corps.action !== "executer") return json(refus("requete_invalide"), 400);

  const demande = validerDemande(corps);
  if ("erreur" in demande) return json(refus(demande.erreur), 400);
  const storeId = demande.store_id;

  // Lectures métier AVEC les droits de l'utilisateur : les politiques RLS
  // s'appliquent exactement comme dans l'application.
  const client = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jeton}` } },
  });

  const il_y_a_30_jours = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  async function ventesParProduit(): Promise<Map<string, number>> {
    const { data } = await client
      .from("sales")
      .select("product_id, quantite")
      .eq("store_id", storeId)
      .gte("date", il_y_a_30_jours)
      .limit(10_000);
    const m = new Map<string, number>();
    for (const v of data ?? []) {
      if (v.product_id) m.set(v.product_id, (m.get(v.product_id) ?? 0) + nombre(v.quantite));
    }
    return m;
  }

  const deps: Dependances = {
    fournisseur: cle ? fournisseurOpenAI(cle, fetch) : null,
    coupe,
    maintenant: () => Date.now(),

    async limites() {
      const { data } = await admin
        .from("ia_reglages_plateforme")
        .select("max_caracteres_entree, max_fichier_mo")
        .single();
      return {
        max_caracteres_entree: data?.max_caracteres_entree ?? 60_000,
        max_fichier_mo: data?.max_fichier_mo ?? 8,
      };
    },

    async reserver(fonctionnalite: Fonctionnalite, tokensEstimes: number) {
      const { data, error } = await admin.rpc("ia_reserver", {
        p_user_id: user.id,
        p_store_id: storeId,
        p_fonctionnalite: fonctionnalite,
        p_tokens_entree_estimes: tokensEstimes,
      });
      if (error || !data) return { ok: false as const, code: "erreur_interne" };
      return data;
    },

    async finaliser(id, statut, tokensEntree, tokensSortie, code, dureeMs) {
      const { error } = await admin.rpc("ia_finaliser", {
        p_consommation_id: id,
        p_statut: statut,
        p_tokens_entree: tokensEntree,
        p_tokens_sortie: tokensSortie,
        p_code_erreur: code,
        p_duree_ms: dureeMs,
      });
      if (error) console.error("ia_finaliser", error.code);
    },

    async proposerAction(consommationId, fonctionnalite, type, resume, charge) {
      const { data, error } = await admin.rpc("ia_proposer_action", {
        p_user_id: user.id,
        p_store_id: storeId,
        p_consommation_id: consommationId,
        p_fonctionnalite: fonctionnalite,
        p_type_action: type,
        p_resume: resume,
        p_charge_utile: charge,
      });
      if (error) console.error("ia_proposer_action", error.code);
      return (data as string | null) ?? null;
    },

    // Résumé AGRÉGÉ : aucun nom de client, aucune coordonnée. Ce que
    // l'utilisateur ne peut pas lire (RLS), le modèle ne le voit pas.
    async resumeBoutique() {
      const [boutique, ventes, achats, depenses, produits] = await Promise.all([
        client.from("stores").select("name, currency_symbol").eq("id", storeId).single(),
        client
          .from("sales")
          .select(
            "date, designation, quantite, total_vente, marge_totale, solde_du, prix_vente_unit, prix_achat_unit_ref",
          )
          .eq("store_id", storeId)
          .gte("date", il_y_a_30_jours)
          .limit(10_000),
        client
          .from("purchases")
          .select("total_achat, solde_du")
          .eq("store_id", storeId)
          .gte("date", il_y_a_30_jours)
          .limit(10_000),
        client
          .from("expenses")
          .select("montant, type")
          .eq("store_id", storeId)
          .gte("date", il_y_a_30_jours)
          .limit(10_000),
        client
          .from("products")
          .select(
            "display_name, designation, stock_disponible, seuil_alerte, prix_achat, prix_vente_defaut, statut",
          )
          .eq("store_id", storeId)
          .limit(5_000),
      ]);
      const devise = boutique.data?.currency_symbol ?? "";
      const v = ventes.data ?? [];
      const parProduit = new Map<string, { q: number; ca: number }>();
      let ca = 0,
        marge = 0,
        impayes = 0,
        ventesAPerte = 0;
      for (const s of v) {
        ca += nombre(s.total_vente);
        marge += nombre(s.marge_totale);
        impayes += nombre(s.solde_du);
        if (nombre(s.prix_vente_unit) < nombre(s.prix_achat_unit_ref)) ventesAPerte++;
        const p = parProduit.get(s.designation) ?? { q: 0, ca: 0 };
        p.q += nombre(s.quantite);
        p.ca += nombre(s.total_vente);
        parProduit.set(s.designation, p);
      }
      const top = [...parProduit.entries()].sort((a, b) => b[1].ca - a[1].ca).slice(0, 15);
      const prods = produits.data ?? [];
      const bas = prods
        .filter(
          (p) => p.statut !== "inactif" && nombre(p.stock_disponible) <= nombre(p.seuil_alerte),
        )
        .slice(0, 30);
      const valeurStock = prods.reduce(
        (t, p) => t + nombre(p.stock_disponible) * nombre(p.prix_achat),
        0,
      );
      const totAchats = (achats.data ?? []).reduce((t, a) => t + nombre(a.total_achat), 0);
      const dettes = (achats.data ?? []).reduce((t, a) => t + nombre(a.solde_du), 0);
      const totDepenses = (depenses.data ?? []).reduce((t, d) => t + nombre(d.montant), 0);
      return [
        `Boutique : ${boutique.data?.name ?? "?"} — devise ${devise} — période : 30 derniers jours (depuis ${il_y_a_30_jours}).`,
        `Ventes : ${v.length} lignes, chiffre d'affaires ${ca.toFixed(2)}, marge ${marge.toFixed(2)}, reste à encaisser ${impayes.toFixed(2)}, lignes vendues sous le prix d'achat : ${ventesAPerte}.`,
        `Achats : total ${totAchats.toFixed(2)}, reste à payer aux fournisseurs ${dettes.toFixed(2)}.`,
        `Dépenses : total ${totDepenses.toFixed(2)}.`,
        `Produits : ${prods.length}, valeur du stock au prix d'achat ${valeurStock.toFixed(2)}.`,
        `Meilleures ventes (désignation : quantité, CA) :`,
        ...top.map(([d, p]) => `- ${d} : ${p.q}, ${p.ca.toFixed(2)}`),
        `Produits au seuil d'alerte ou en dessous (désignation : disponible / seuil) :`,
        ...bas.map(
          (p) =>
            `- ${p.display_name || p.designation} : ${nombre(p.stock_disponible)} / ${nombre(p.seuil_alerte)}`,
        ),
      ].join("\n");
    },

    async candidatsReappro(): Promise<CandidatReappro[]> {
      const [{ data: produits }, ventes] = await Promise.all([
        client
          .from("products")
          .select("id, display_name, designation, stock_disponible, seuil_alerte, statut")
          .eq("store_id", storeId)
          .limit(5_000),
        ventesParProduit(),
      ]);
      return (produits ?? [])
        .filter(
          (p) => p.statut !== "inactif" && nombre(p.stock_disponible) <= nombre(p.seuil_alerte),
        )
        .slice(0, 60)
        .map((p) => ({
          product_id: p.id,
          designation: p.display_name || p.designation,
          stock_disponible: nombre(p.stock_disponible),
          seuil_alerte: nombre(p.seuil_alerte),
          vendus_30_jours: ventes.get(p.id) ?? 0,
        }));
    },
  };

  try {
    return json(await traiter(demande, deps));
  } catch (e) {
    // Journal sans contenu : seulement le type d'erreur.
    console.error("ia", e instanceof Error ? e.name : "inconnue");
    return json(refus("erreur_interne"), 500);
  }
});
