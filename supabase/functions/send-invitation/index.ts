import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Send email via Resend
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#1e293b;border-radius:20px;overflow:hidden;border:1px solid #334155;">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#059669,#0891b2);padding:40px 40px 30px;text-align:center;">
      <div style="width:64px;height:64px;background:rgba(255,255,255,0.15);border-radius:16px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">
        <span style="font-size:28px;">🏪</span>
      </div>
      <h1 style="color:#fff;font-size:22px;margin:0;font-weight:700;">Invitation à rejoindre</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:16px;">${store_name ?? "une boutique"}</p>
    </div>

    <!-- Body -->
    <div style="padding:36px 40px;">
      <p style="color:#94a3b8;font-size:14px;margin:0 0 16px;">Bonjour,</p>
      <p style="color:#e2e8f0;font-size:15px;line-height:1.7;margin:0 0 24px;">
        <strong style="color:#fff;">${invited_by_name ?? "Un utilisateur"}</strong> vous invite à rejoindre 
        <strong style="color:#10b981;">${store_name ?? "sa boutique"}</strong> en tant que 
        <strong style="color:#fff;">${role === "seller" ? "Vendeur" : role === "collaborator" ? "Collaborateur" : role}</strong> 
        sur <strong style="color:#fff;">Balsama Auto Gestion</strong>.
      </p>

      <!-- CTA Button -->
      <div style="text-align:center;margin:32px 0;">
        <a href="${inviteLink}" style="display:inline-block;background:linear-gradient(135deg,#059669,#0891b2);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:12px;letter-spacing:0.02em;">
          ✅ Accepter l'invitation
        </a>
      </div>

      <!-- Info box -->
      <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin:24px 0;">
        <p style="color:#64748b;font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">En rejoignant, vous pourrez :</p>
        <ul style="color:#94a3b8;font-size:13px;margin:0;padding-left:20px;line-height:1.8;">
          <li>Accéder aux produits de la boutique</li>
          <li>Enregistrer des ventes et commandes</li>
          <li>Consulter vos activités</li>
        </ul>
      </div>

      <p style="color:#475569;font-size:12px;text-align:center;line-height:1.6;margin:24px 0 0;">
        Ce lien expire dans <strong style="color:#94a3b8;">7 jours</strong>. Si vous n'attendiez pas cette invitation, ignorez cet e-mail.<br>
        Lien alternatif : <a href="${inviteLink}" style="color:#10b981;word-break:break-all;">${inviteLink}</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #1e293b;padding:20px 40px;background:#0f172a;">
      <p style="color:#334155;font-size:12px;text-align:center;margin:0;">
        Balsama Auto Gestion — Système professionnel de gestion de stock & trésorerie
      </p>
    </div>
  </div>
</body>
</html>`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Balsama Auto Gestion <noreply@balsama.app>",
        to: [invited_email],
        subject: `Invitation à rejoindre ${store_name ?? "une boutique"} sur Balsama`,
        html: emailHtml,
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