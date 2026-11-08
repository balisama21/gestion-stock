import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Cache-Control": "no-store" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });

async function keys() {
  const read = () => db.from("rappel_push_config").select("clefs").eq("id", true).maybeSingle().throwOnError();
  let entry = (await read()).data;
  if (!entry) {
    await db.from("rappel_push_config").upsert({ id: true, clefs: webpush.generateVAPIDKeys() }, { onConflict: "id", ignoreDuplicates: true }).throwOnError();
    entry = (await read()).data;
  }
  return entry!.clefs;
}

function endpointAllowed(endpoint: string) {
  const url = new URL(endpoint);
  return url.protocol === "https:" && !url.port && !url.username && !url.password &&
    (["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"].includes(url.hostname) ||
      url.hostname.endsWith(".push.apple.com") || url.hostname.endsWith(".notify.windows.com"));
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, {headers});
  if (req.method !== "POST") return reply({}, 405);
  try {
    const body = await req.json();
    if (body.action === "dispatch") {
      const token = req.headers.get("X-Rappel-Cron");
      if (!token || !(await db.rpc("autoriser_cron_rappels", {jeton: token}).throwOnError()).data) return reply({}, 403);
      const vapidDetails = { subject: "https://tantana-suite.com", ...await keys() };
      const {data} = await db.rpc("reserver_rappels_push").throwOnError();
      for (let i = 0; i < data.length; i += 12) {
        await Promise.all(data.slice(i, i+12).map(async row => {
          try {
            await webpush.sendNotification(row.abonnement, JSON.stringify({ tag: row.rappel + "-" + row.echeance }), { vapidDetails, TTL: 300, urgency: "high", timeout: 5000 });
            await db.from("rappel_push_envois").update({envoye:true}).match({appareil:row.appareil,rappel:row.rappel,echeance:row.echeance}).throwOnError();
          } catch (error) {
            if ([404,410].includes(error.statusCode)) await db.from("rappel_push_appareils").delete().eq("id",row.appareil).throwOnError();
          }
        }));
      }
      return reply({reserved:data.length});
    }
    const jwt = req.headers.get("Authorization")?.replace(/^Bearer /i, "");
    if (!jwt) return reply({},401);
    const {data:{user}} = await db.auth.getUser(jwt);
    if (!user) return reply({},401);
    if (body.action === "key") return reply({publicKey:(await keys()).publicKey});
    const sub = body.subscription;
    if (body.action !== "subscribe" || !sub || typeof sub.endpoint !== "string" || sub.endpoint.length > 4096 ||
        !endpointAllowed(sub.endpoint) || !/^[\w-]{87}$/.test(sub.keys?.p256dh) || !/^[\w-]{22}$/.test(sub.keys?.auth)) return reply({},400);
    const zone = new Intl.DateTimeFormat("fr", {timeZone:body.timezone}).resolvedOptions().timeZone;
    const record = {user_id:user.id,endpoint:sub.endpoint,abonnement:{endpoint:sub.endpoint,keys:sub.keys},fuseau:zone};
    const {error} = await db.from("rappel_push_appareils").insert(record);
    if (error && error.code !== "23505") throw error;
    if (error) {
      const {data} = await db.from("rappel_push_appareils").update({fuseau:zone}).eq("endpoint",sub.endpoint).eq("user_id",user.id).select("id").throwOnError();
      if (!data?.length) return reply({},409);
    }
    return reply({ok:true});
  } catch { return reply({error:"Traitement du rappel indisponible."},500); }
});
