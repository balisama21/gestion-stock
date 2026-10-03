import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { emailInvitation } from "./email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      invited_email,
      store_id,
      role = "seller",
      permissions = [],
      invited_by_name,
      store_name,
      app_url,
    } = await req.json();

    if (!invited_email || !store_id || !app_url) {
      return new Response(
        JSON.stringify({ error: "Champs requis : invited_email, store_id, app_url" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(invited_email)) {
      return new Response(JSON.stringify({ error: "Adresse e-mail invalide." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Identifie l'appelant depuis son JWT.
    const authHeader = req.headers.get("Authorization");
    let invitedBy: string | null = null;
    if (authHeader) {
      const {
        data: { user },
      } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      invitedBy = user?.id ?? null;
    }

    if (!invitedBy) {
      return new Response(JSON.stringify({ error: "Authentification requise." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // FAILLE CORRIGÉE (19/08/2026) : cette fonction utilisait la clé
    // service_role (contourne toutes les RLS) et faisait confiance à
    // n'importe quel store_id envoyé par le client, sans jamais vérifier
    // que l'appelant possédait réellement cette boutique. N'importe quel
    // compte authentifié pouvait donc inviter quelqu'un dans une boutique
    // qui n'était pas la sienne. On vérifie maintenant explicitement que
    // l'appelant est propriétaire (ou admin plateforme) avant toute chose.
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, owner_id")
      .eq("id", store_id)
      .single();

    if (storeError || !store) {
      return new Response(JSON.stringify({ error: "Boutique introuvable." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", invitedBy)
      .single();

    const isOwner = store.owner_id === invitedBy;
    const isPlatformAdmin = callerProfile?.is_platform_admin === true;

    if (!isOwner && !isPlatformAdmin) {
      return new Response(
        JSON.stringify({ error: "Vous n'êtes pas propriétaire de cette boutique." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Marque blanche : celle de la boutique (stores.marque_id), sinon la
    // fiche branding posée sur la boutique elle-même.
    const { data: etiquette } = await supabase
      .from("stores")
      .select("marque_id")
      .eq("id", store_id)
      .maybeSingle();
    const { data: marque } = await supabase
      .from("branding")
      .select("app_name, short_name, store_id, primary_color, logo_url")
      .eq(etiquette?.marque_id ? "id" : "store_id", etiquette?.marque_id ?? store_id)
      .maybeSingle();
    // Expéditeur sur le domaine du client (vérifié chez Resend), sinon celui de Tantana.
    const { data: domaine } = marque
      ? await supabase
          .from("custom_domains")
          .select("hostname")
          .eq("store_id", marque.store_id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle()
      : { data: null };
    const adresseExpediteur = `noreply@${domaine?.hostname ?? "balsama.app"}`;
    const nomApp = (marque?.app_name ?? "Balsama Auto Gestion").replace(/[<>"]/g, "");
    const nomCourt = marque
      ? (marque.short_name || marque.app_name).replace(/[<>"]/g, "")
      : "Balsama";
    const piedDePage = marque
      ? nomApp
      : "Balsama Auto Gestion — Système professionnel de gestion de stock & trésorerie";

    // Generate token, short code and expiry
    const token = crypto.randomUUID();
    const codeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I ambigus
    const randomBlock = () =>
      Array.from({ length: 4 }, () => codeChars[Math.floor(Math.random() * codeChars.length)]).join("");
    const inviteCode = `INV-${randomBlock()}-${randomBlock()}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Insert invitation into DB
    const { error: insertError } = await supabase.from("collaborator_invitations").insert({
      store_id,
      invited_email,
      invited_by: invitedBy,
      role,
      permissions,
      status: "pending",
      token,
      invite_code: inviteCode,
      expires_at: expiresAt,
    });

    if (insertError) {
      return new Response(JSON.stringify({ error: "Erreur DB : " + insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build invitation link
    const inviteLink = `${app_url}/accept-invite?token=${token}`;

    const { html: emailHtml, text: emailText } = emailInvitation({
      nomApp,
      piedDePage,
      couleur: /^#[0-9a-f]{6}$/i.test(marque?.primary_color ?? "") ? marque!.primary_color! : "#008655",
      logoUrl: /^https:\/\/[^"'\s<>]+$/.test(marque?.logo_url ?? "") ? marque!.logo_url! : null,
      boutique: store_name ?? "une boutique",
      invitePar: invited_by_name ?? "Un utilisateur",
      role: role === "seller" ? "vendeur" : role === "collaborator" ? "collaborateur" : role,
      lien: inviteLink,
    });

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${nomApp} <${adresseExpediteur}>`,
        to: [invited_email],
        subject: `Invitation à rejoindre ${store_name ?? "une boutique"} sur ${nomCourt}`,
        html: emailHtml,
        text: emailText,
      }),
    });

    if (!emailResponse.ok) {
      const emailError = await emailResponse.text();
      // Log but don't fail — invitation is saved in DB
      console.error("Resend API error:", emailError);
      return new Response(
        JSON.stringify({
          success: true,
          warning: "Invitation créée mais e-mail non envoyé. Vérifiez votre clé Resend.",
          token,
          invite_code: inviteCode,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invitation envoyée avec succès !",
        token,
        invite_code: inviteCode,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur interne";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});