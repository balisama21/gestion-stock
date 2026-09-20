import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * LE RÉSUMÉ DE PRÉALERTE, PAR E-MAIL.
 *
 * Appelée par `public.demander_les_resumes_par_email()`, elle-même
 * réveillée toutes les heures par pg_cron. Une requête par boutique qui
 * a quelque chose à envoyer ; le corps ne porte que l'identifiant.
 *
 * ── Ce qu'elle fait, et dans cet ordre ──
 *
 *   1. Relit les préalertes libérées mais pas encore envoyées.
 *   2. Compose un message groupé — jamais un e-mail par produit.
 *   3. Envoie par Resend, comme `send-invitation`.
 *   4. ET SEULEMENT ALORS marque `email_le`. Un envoi refusé laisse les
 *      lignes en attente : le réveil suivant réessaiera, plutôt que de
 *      perdre l'alerte en silence.
 *
 * ── Sur l'autorisation ──
 *
 * L'appel porte la clé anon, qui est publique et voyage déjà dans le
 * paquet client. Ce n'est donc pas un secret, et c'est assumé : tout ce
 * qu'un appel non désiré peut provoquer, c'est l'envoi d'un e-mail qui
 * était de toute façon dû, à une adresse que l'appelant ne choisit pas.
 * Rien ne se crée, rien ne se lit en retour — la réponse ne contient
 * qu'un compte.
 *
 * Le vrai pouvoir est la clé de service, qui vit ici, dans les secrets
 * de la fonction, et nulle part ailleurs.
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

interface LignePrealerte {
  product_id: string;
  produit: string;
  numero: string | null;
  stock_actuel: number;
  seuil_alerte: number;
  unite: string | null;
}

const echapper = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** « 5 unités », « 5 litres » quand l'unité est renseignée. */
const quantite = (n: number, unite: string | null) => {
  const mot = unite?.trim() || "unité";
  return `${n} ${mot}${n > 1 && !mot.endsWith("s") ? "s" : ""}`;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { store_id, app_url } = await req.json();
    if (!store_id) return json({ error: "Champ requis : store_id" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Ce qui attend d'être envoyé. La vue ne rend que la bande
    //    orange : un produit déjà sous son seuil relève de l'alerte
    //    rouge, et « approche du seuil » y serait faux.
    const { data: lignes, error: erreurLignes } = await supabase
      .from("prealertes_a_annoncer")
      .select("product_id, produit, numero, stock_actuel, seuil_alerte, unite")
      .eq("store_id", store_id)
      .not("notifiee_le", "is", null)
      .is("email_le", null)
      .order("stock_actuel", { ascending: true });

    if (erreurLignes) return json({ error: erreurLignes.message }, 500);
    if (!lignes || lignes.length === 0) return json({ envoye: 0, raison: "rien en attente" });

    // 2. À qui écrire. L'adresse du PROPRIÉTAIRE, et non celle de la
    //    boutique, qui n'est renseignée que par intermittence.
    const { data: boutique } = await supabase
      .from("stores")
      .select("name, owner_id")
      .eq("id", store_id)
      .single();

    if (!boutique) return json({ error: "Boutique introuvable." }, 404);

    const { data: proprietaire } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", boutique.owner_id)
      .single();

    if (!proprietaire?.email) {
      return json({ envoye: 0, raison: "le proprietaire n a pas d adresse" });
    }

    // 3. Le message. Une ligne par produit, au format exact demandé :
    //    « Huile 1 L : 5 unités restantes, seuil défini à 3. »
    const l = lignes as LignePrealerte[];
    const titre =
      l.length > 1
        ? `${l.length} produits approchent de leur seuil`
        : "1 produit approche de son seuil";

    const rangs = l
      .map(
        (p) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e8e6e1;">
          <strong style="color:#1a1a18;">${echapper(p.produit)}</strong>
          ${p.numero ? `<span style="color:#8a877f;font-size:12px;"> · ${echapper(p.numero)}</span>` : ""}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e8e6e1;text-align:right;white-space:nowrap;">
          <strong style="color:#b06f12;">${quantite(p.stock_actuel, p.unite)}</strong>
          <span style="color:#8a877f;font-size:12px;"> restantes</span>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e8e6e1;text-align:right;white-space:nowrap;color:#8a877f;font-size:13px;">
          seuil ${p.seuil_alerte}
        </td>
      </tr>`,
      )
      .join("");

    const bouton = app_url
      ? `<p style="margin:24px 0 0;">
           <a href="${echapper(app_url)}"
              style="display:inline-block;background:#2f6f4f;color:#ffffff;text-decoration:none;
                     padding:12px 20px;border-radius:10px;font-weight:600;font-size:14px;">
             Préparer la commande
           </a>
         </p>`
      : "";

    const html = `<!doctype html>
<html lang="fr">
<body style="margin:0;padding:24px;background:#f5f4f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e8e6e1;border-radius:14px;overflow:hidden;">
    <div style="padding:24px 28px 8px;">
      <p style="margin:0 0 4px;color:#8a877f;font-size:12px;letter-spacing:.06em;text-transform:uppercase;">
        ${echapper(boutique.name)}
      </p>
      <h1 style="margin:0;font-size:19px;font-weight:600;color:#1a1a18;">${titre}</h1>
      <p style="margin:8px 0 0;color:#57544d;font-size:14px;line-height:1.55;">
        Il reste de quoi vendre, mais plus pour longtemps. C'est le moment de
        commander, pendant qu'il y a encore du délai.
      </p>
    </div>

    <table role="presentation" style="width:100%;border-collapse:collapse;margin-top:16px;">
      ${rangs}
    </table>

    <div style="padding:20px 28px 28px;">
      ${bouton}
      <p style="margin:20px 0 0;color:#8a877f;font-size:12px;line-height:1.6;">
        Vous recevez ce message parce que la préalerte de stock est active pour
        ${echapper(boutique.name)}. Elle se règle dans Paramètres, section
        « Alertes de stock ».
      </p>
    </div>
  </div>
</body>
</html>`;

    const envoi = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Tantana Suite <noreply@balsama.app>",
        to: [proprietaire.email],
        subject: `${titre} — ${boutique.name}`,
        html,
      }),
    });

    if (!envoi.ok) {
      // On NE marque PAS : le réveil suivant réessaiera. Perdre une
      // alerte en silence serait pire qu'un e-mail en retard.
      const detail = await envoi.text();
      console.error("Resend a refuse l envoi :", detail);
      return json({ envoye: 0, erreur: "envoi refuse, sera retente" });
    }

    // 4. Marqué seulement maintenant.
    const { error: erreurMarquage } = await supabase
      .from("prealertes_stock")
      .update({ email_le: new Date().toISOString() })
      .in(
        "product_id",
        l.map((p) => p.product_id),
      );

    if (erreurMarquage) {
      // L'e-mail est parti. Le signaler plutôt que de le taire : sans
      // marquage, le prochain passage renverra le même message.
      console.error("E-mail envoye mais marquage echoue :", erreurMarquage.message);
      return json({ envoye: l.length, avertissement: "marquage echoue" });
    }

    return json({ envoye: l.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur interne";
    return json({ error: message }, 500);
  }
});
