import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Dépôt d'une demande de réinitialisation de mot de passe.
 *
 * Publique par nécessité : celui qui a oublié son mot de passe n'est
 * précisément pas connecté. Elle enregistre la demande pour que le
 * propriétaire la traite, et ne renvoie jamais rien d'autre qu'un accusé
 * de réception identique pour tout le monde.
 *
 * Ce silence est délibéré. Répondre « cette adresse n'est pas connue »
 * transformerait ce formulaire en outil de recensement : il suffirait
 * d'essayer des adresses pour dresser la liste des utilisateurs de
 * l'application. Google, Apple et GitHub répondent de la même façon,
 * pour la même raison. L'information existe, elle est enregistrée, mais
 * elle n'est lisible que du côté administrateur.
 *
 * Étant ouverte, elle se protège seule : format vérifié, une demande par
 * adresse et par heure, et un plafond global qui empêche de gonfler la
 * table. Ces refus restent invisibles du demandeur, qui voit toujours la
 * même réponse.
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

/** Réponse unique, quelle que soit l'issue réelle. */
const ACCUSE = { success: true };

const UNE_HEURE_MS = 60 * 60 * 1000;
const PLAFOND_HORAIRE_GLOBAL = 50;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      // Un format invalide est la seule chose qu'on peut dire sans rien
      // révéler : elle ne dépend pas du contenu de la base.
      return json({ error: "Adresse e-mail invalide." }, 400);
    }

    const adresse = email.trim().toLowerCase();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const depuisUneHeure = new Date(Date.now() - UNE_HEURE_MS).toISOString();

    // Une seule demande par adresse et par heure.
    const { data: dejaDemande } = await supabase
      .from("password_recovery_requests")
      .select("id")
      .eq("email", adresse)
      .gte("requested_at", depuisUneHeure)
      .maybeSingle();

    if (dejaDemande) return json(ACCUSE);

    // Plafond global : empêche de remplir la table à coups d'adresses
    // inventées.
    const { count } = await supabase
      .from("password_recovery_requests")
      .select("id", { count: "exact", head: true })
      .gte("requested_at", depuisUneHeure);

    if ((count ?? 0) >= PLAFOND_HORAIRE_GLOBAL) return json(ACCUSE);

    // L'adresse correspond-elle à un compte ? La réponse ne sort pas
    // d'ici : elle est seulement rangée dans la ligne.
    const { data: profil } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", adresse)
      .maybeSingle();

    await supabase.from("password_recovery_requests").insert({
      email: adresse,
      user_id: profil?.id ?? null,
      status: "pending",
    });

    return json(ACCUSE);
  } catch {
    // Même une panne interne ne doit pas se distinguer d'un succès : la
    // différence de réponse serait elle-même une fuite.
    return json(ACCUSE);
  }
});
