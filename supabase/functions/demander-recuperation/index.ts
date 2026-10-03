import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { emailRecuperation } from "./email.ts";

declare const EdgeRuntime: { waitUntil(promesse: Promise<unknown>): void };

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
 * Étant ouverte, elle se protège seule : format vérifié, 2 minutes entre
 * deux demandes et 5 par heure pour une adresse, et un plafond global qui
 * empêche de gonfler la table. Ces refus restent invisibles du demandeur, qui voit toujours la
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
const DELAI_ENTRE_DEMANDES_MS = 2 * 60 * 1000;
const PLAFOND_HORAIRE_PAR_ADRESSE = 5;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, hote } = await req.json();

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

    // Par adresse : 2 minutes entre deux demandes, 5 au plus par heure.
    const { data: recentes } = await supabase
      .from("password_recovery_requests")
      .select("requested_at")
      .eq("email", adresse)
      .gte("requested_at", depuisUneHeure)
      .order("requested_at", { ascending: false });

    const derniere = recentes?.[0] ? Date.parse(recentes[0].requested_at) : 0;
    if (Date.now() - derniere < DELAI_ENTRE_DEMANDES_MS) return json(ACCUSE);
    if ((recentes?.length ?? 0) >= PLAFOND_HORAIRE_PAR_ADRESSE) return json(ACCUSE);

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

    const { data: demande } = await supabase
      .from("password_recovery_requests")
      .insert({
        email: adresse,
        user_id: profil?.id ?? null,
        status: "pending",
      })
      .select("id")
      .single();

    // Sur un domaine de marque (expéditeur vérifié chez Resend), le lien part
    // seul par e-mail ; sinon la demande reste en attente pour l'administrateur.
    // En arrière-plan : une réponse plus lente trahirait les comptes existants.
    const envoyer = async () => {
      if (!profil || !demande || typeof hote !== "string") return;
      const { data: domaine } = await supabase
        .from("custom_domains")
        .select("hostname, store_id")
        .eq("hostname", hote.trim().toLowerCase())
        .eq("is_active", true)
        .maybeSingle();
      const { data: marque } = domaine
        ? await supabase
            .from("branding")
            .select("app_name, primary_color, logo_url")
            .eq("store_id", domaine.store_id)
            .maybeSingle()
        : { data: null };

      if (domaine && marque) {
        // La redirection vient de custom_domains, jamais du client.
        const { data: lien } = await supabase.auth.admin.generateLink({
          type: "recovery",
          email: adresse,
          options: { redirectTo: `https://${domaine.hostname}/reset-password` },
        });

        if (lien?.properties?.action_link) {
          const nomApp = marque.app_name.replace(/[<>"]/g, "");
          const { html, text } = emailRecuperation({
            nomApp,
            couleur: /^#[0-9a-f]{6}$/i.test(marque.primary_color ?? "") ? marque.primary_color! : "#008655",
            logoUrl: /^https:\/\/[^"'\s<>]+$/.test(marque.logo_url ?? "") ? marque.logo_url! : null,
            lien: lien.properties.action_link,
          });
          const envoi = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")!}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: `${nomApp} <noreply@${domaine.hostname}>`,
              to: [adresse],
              subject: `Réinitialiser votre mot de passe ${nomApp}`,
              html,
              text,
            }),
          });

          if (envoi.ok) {
            await supabase
              .from("password_recovery_requests")
              .update({ status: "handled", handled_at: new Date().toISOString() })
              .eq("id", demande.id);
          } else {
            console.error("Resend a refuse l envoi :", await envoi.text());
          }
        }
      }
    };
    EdgeRuntime.waitUntil(envoyer().catch((e) => console.error(e)));

    return json(ACCUSE);
  } catch {
    // Même une panne interne ne doit pas se distinguer d'un succès : la
    // différence de réponse serait elle-même une fuite.
    return json(ACCUSE);
  }
});
