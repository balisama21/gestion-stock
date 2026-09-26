import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Synchronise les taux de change de référence, puis recalcule les devises
 * en mode « auto » de toutes les boutiques.
 *
 * Appelée deux fois par jour par pg_cron (`demander_la_synchro_des_taux`),
 * et par le bouton « Actualiser » des paramètres. Hors cron, on ne
 * rappelle pas l'API si la référence a moins de 6 h.
 *
 * Source principale : open.er-api.com (gratuite, sans clé, couvre MGA,
 * KMF, XOF…). Secours : fawazahmed0/currency-api servie par jsDelivr.
 * Si les deux échouent, les derniers taux connus restent en place.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Taux = Record<string, number>;

async function depuisErApi(): Promise<Taux> {
  const r = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`open.er-api ${r.status}`);
  const d = await r.json();
  if (d.result !== "success" || !d.rates) throw new Error("open.er-api : réponse invalide");
  return d.rates as Taux;
}

async function depuisCurrencyApi(): Promise<Taux> {
  const urls = [
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
    "https://latest.currency-api.pages.dev/v1/currencies/usd.json",
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!r.ok) continue;
      const d = await r.json();
      if (!d.usd) continue;
      const out: Taux = {};
      for (const [k, v] of Object.entries(d.usd as Record<string, number>)) {
        if (/^[a-z]{3}$/.test(k) && typeof v === "number") out[k.toUpperCase()] = v;
      }
      return out;
    } catch {
      /* essai suivant */
    }
  }
  throw new Error("currency-api indisponible");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let source = "app";
  try {
    source = (await req.json())?.source ?? "app";
  } catch {
    /* corps vide */
  }

  const { data: derniere } = await supabase
    .from("taux_reference")
    .select("recupere_le")
    .order("recupere_le", { ascending: false })
    .limit(1)
    .maybeSingle();
  const age = derniere ? Date.now() - new Date(derniere.recupere_le).getTime() : Infinity;
  const aRafraichir = source === "cron" || age > 6 * 3600 * 1000;

  let fournisseur: string | null = null;
  let erreur: string | null = null;

  if (aRafraichir) {
    let taux: Taux | null = null;
    try {
      taux = await depuisErApi();
      fournisseur = "open.er-api.com";
    } catch (e1) {
      try {
        taux = await depuisCurrencyApi();
        fournisseur = "currency-api";
      } catch (e2) {
        erreur = `${(e1 as Error).message} ; ${(e2 as Error).message}`;
      }
    }

    if (taux) {
      const maintenant = new Date().toISOString();
      const lignes = Object.entries(taux)
        .filter(([code, v]) => /^[A-Z]{3}$/.test(code) && v > 0)
        .map(([code, v]) => ({ code, unites_par_usd: v, source: fournisseur, recupere_le: maintenant }));
      const { error } = await supabase.from("taux_reference").upsert(lignes, { onConflict: "code" });
      if (error) erreur = error.message;
    }
  }

  const { data: appliques, error: errApp } = await supabase.rpc("appliquer_taux_automatiques", {
    p_store_id: null,
  });
  if (errApp) return json({ error: errApp.message }, 500);

  return json({
    rafraichi: aRafraichir && !erreur,
    fournisseur,
    erreur,
    devises_mises_a_jour: appliques,
  });
});
