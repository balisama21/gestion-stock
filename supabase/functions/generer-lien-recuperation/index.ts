import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Génère un lien de réinitialisation de mot de passe, sans e-mail.
 *
 * Le service d'envoi n'accepte aujourd'hui qu'une seule adresse
 * destinataire, tant qu'aucun domaine n'est vérifié. Un collaborateur
 * qui oublie son mot de passe n'a donc aucun recours : le lien ne lui
 * parviendra jamais. Cette fonction produit ce lien et le rend au
 * propriétaire de la boutique, qui le transmet lui-même — exactement ce
 * que l'application fait déjà pour les invitations quand l'e-mail
 * échoue.
 *
 * Ce lien donne le contrôle du compte à qui le détient. Trois garde-fous
 * en découlent, tous vérifiés ici et jamais côté client :
 *
 *   - l'appelant doit être authentifié ;
 *   - un propriétaire de boutique ne peut agir que sur les membres de
 *     cette boutique, dont il doit être le propriétaire ;
 *   - l'administrateur de la plateforme, lui, peut agir sur n'importe
 *     quel compte, y compris ceux qui possèdent leur propre boutique et
 *     n'appartiennent à aucune équipe. C'est lui l'exploitant de
 *     l'application ; sans cela un client isolé, propriétaire de sa
 *     seule boutique, n'aurait plus aucun recours.
 *
 * L'adresse e-mail n'est jamais reprise du corps de la requête : elle
 * est relue en base à partir de l'identifiant, sans quoi il suffirait
 * d'envoyer l'adresse de quelqu'un d'autre.
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, store_id, app_url } = await req.json();

    if (!user_id || !app_url) {
      return json({ error: "Champs requis : user_id, app_url." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Qui appelle ?
    const entete = req.headers.get("Authorization");
    if (!entete) return json({ error: "Authentification requise." }, 401);

    const {
      data: { user: appelant },
    } = await supabase.auth.getUser(entete.replace("Bearer ", ""));

    if (!appelant) return json({ error: "Authentification requise." }, 401);

    // 2. Administrateur de la plateforme : le contrôle s'arrête là.
    const { data: profilAppelant } = await supabase
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", appelant.id)
      .single();

    const estAdminPlateforme = profilAppelant?.is_platform_admin === true;

    if (!estAdminPlateforme) {
      // 3. Sinon, il faut une boutique, et l'appelant doit la posséder.
      if (!store_id) {
        return json({ error: "Champ requis : store_id." }, 400);
      }

      const { data: boutique, error: erreurBoutique } = await supabase
        .from("stores")
        .select("id, owner_id")
        .eq("id", store_id)
        .single();

      if (erreurBoutique || !boutique) return json({ error: "Boutique introuvable." }, 404);

      if (boutique.owner_id !== appelant.id) {
        return json({ error: "Vous n'êtes pas propriétaire de cette boutique." }, 403);
      }

      // 4. Et la personne visée doit en être membre. Le propriétaire est
      //    traité à part : il n'apparaît pas nécessairement dans
      //    store_members alors que le compte est le sien.
      if (boutique.owner_id !== user_id) {
        const { data: appartenance } = await supabase
          .from("store_members")
          .select("id")
          .eq("store_id", store_id)
          .eq("user_id", user_id)
          .maybeSingle();

        if (!appartenance) {
          return json({ error: "Cette personne n'est pas membre de cette boutique." }, 403);
        }
      }
    }

    // 5. L'adresse est relue en base, jamais reçue du client.
    const { data: cible, error: erreurCible } = await supabase.auth.admin.getUserById(user_id);
    const email = cible?.user?.email;
    if (erreurCible || !email) return json({ error: "Compte introuvable." }, 404);

    const fournisseurs = (cible.user.app_metadata?.providers as string[] | undefined) ?? [];
    const aDejaUnMotDePasse = fournisseurs.includes("email");

    // 6. Le lien lui-même. `generateLink` le fabrique sans rien envoyer :
    //    c'est précisément ce qu'on cherche ici.
    const { data: lien, error: erreurLien } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${app_url}/reset-password` },
    });

    if (erreurLien || !lien?.properties?.action_link) {
      return json({ error: erreurLien?.message ?? "Génération du lien impossible." }, 500);
    }

    return json({
      success: true,
      lien: lien.properties.action_link,
      email,
      a_deja_un_mot_de_passe: aDejaUnMotDePasse,
    });
  } catch (err: unknown) {
    return json({ error: err instanceof Error ? err.message : "Erreur interne." }, 500);
  }
});
