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
    const { token, user_id } = await req.json();

    if (!token || !user_id) {
      return new Response(JSON.stringify({ error: "Champs requis : token, user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Find the pending invitation
    const { data: invitation, error: inviteError } = await supabase
      .from("collaborator_invitations")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (inviteError || !invitation) {
      return new Response(
        JSON.stringify({ error: "Invitation invalide, introuvable ou déjà utilisée." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      // Mark as expired
      await supabase
        .from("collaborator_invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);

      return new Response(JSON.stringify({ error: "Cette invitation a expiré." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Add user to store_members
    const { error: memberError } = await supabase.from("store_members").insert({
      store_id: invitation.store_id,
      user_id: user_id,
      role: invitation.role,
      invited_by: invitation.invited_by,
    });

    if (memberError && memberError.code !== "23505") {
      // Ignore unique violation if already member
      return new Response(
        JSON.stringify({ error: "Erreur lors de l'ajout au workspace : " + memberError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Mark invitation as accepted
    await supabase
      .from("collaborator_invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);

    // 4. Update user profile to activated (bypassing payment)
    await supabase.from("profiles").update({ status: "activated" }).eq("id", user_id);

    return new Response(
      JSON.stringify({ success: true, message: "Invitation acceptée avec succès !" }),
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
