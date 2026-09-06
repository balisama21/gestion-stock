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
 * Ce lien donne le contrôle du compte à qui le détient. Une seule
 * personne peut donc le produire : l'administrateur de la plateforme,
 * celui qui exploite l'application. Ni les propriétaires de boutique,
 * ni personne d'autre — c'est le schéma de la clé d'activation, où la
 * délivrance passe par une main unique.
 *
 * En contrepartie, cette main n'est arrêtée par aucune appartenance : la
 * personne visée peut n'être membre d'aucune boutique, appartenir à une
 * boutique tierce ou posséder la sienne. C'est justement l'utilisateur
 * isolé, sans propriétaire au-dessus de lui, qui n'aurait sinon aucun
 * recours.
 *
 * Le statut est relu en base à chaque appel, jamais reçu du client, et
 * l'adresse e-mail l'est aussi : la déduire du corps de la requête
 * permettrait d'en viser une autre que celle du compte désigné.
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
    const { user_id, app_url } = await req.json();

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

    // 2. Est-il l'administrateur de la plateforme ? Rien d'autre n'ouvre
    //    cette porte.
    const { data: profilAppelant } = await supabase
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", appelant.id)
      .single();

    if (profilAppelant?.is_platform_admin !== true) {
      return json(
        { error: "Seul l'administrateur de l'application peut délivrer un lien." },
        403,
      );
    }

    // 3. L'adresse est relue en base, jamais reçue du client.
    const { data: cible, error: erreurCible } = await supabase.auth.admin.getUserById(user_id);
    const email = cible?.user?.email;
    if (erreurCible || !email) return json({ error: "Compte introuvable." }, 404);

    const fournisseurs = (cible.user.app_metadata?.providers as string[] | undefined) ?? [];
    const aDejaUnMotDePasse = fournisseurs.includes("email");

    // 4. Le lien lui-même. `generateLink` le fabrique sans rien envoyer :
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
