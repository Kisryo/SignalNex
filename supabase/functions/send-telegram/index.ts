import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: "Supabase Edge Function secrets are not configured." }, 500);
  }

  if (!telegramToken) {
    return jsonResponse({ ok: false, error: "TELEGRAM_BOT_TOKEN is not configured." }, 500);
  }

  const authHeader = request.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace("Bearer ", "");
  if (!jwt) {
    return jsonResponse({ ok: false, error: "Missing authenticated user token." }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  if (userError || !userData.user) {
    return jsonResponse({ ok: false, error: "Invalid authenticated user token." }, 401);
  }

  let payload: { clientId?: string; message?: string; subject?: string };
  try {
    payload = await request.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Invalid request body." }, 400);
  }

  const clientId = payload.clientId?.trim();
  const message = payload.message?.trim();
  const subject = payload.subject?.trim() || "AdvisorFlow Telegram message";

  if (!clientId || !message) {
    return jsonResponse({ ok: false, error: "clientId and message are required." }, 400);
  }

  if (message.length > 3900) {
    return jsonResponse({ ok: false, error: "Telegram message is too long." }, 400);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, organization_id, full_name, role")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return jsonResponse({ ok: false, error: "AdvisorFlow profile is not linked to this user." }, 403);
  }

  if (profile.role !== "Advisor") {
    return jsonResponse({ ok: false, error: "Only advisors can send client Telegram messages." }, 403);
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, organization_id, advisor_id, name, consent_status, telegram_chat_id, telegram_opt_in")
    .eq("id", clientId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();

  if (clientError || !client) {
    return jsonResponse({ ok: false, error: "Client was not found." }, 404);
  }

  if (client.advisor_id !== profile.id) {
    return jsonResponse({ ok: false, error: "Client is not assigned to this advisor." }, 403);
  }

  if (client.consent_status !== "Verified") {
    return jsonResponse({ ok: false, error: "Client consent must be verified before Telegram sending." }, 403);
  }

  if (!client.telegram_opt_in || !client.telegram_chat_id) {
    return jsonResponse({ ok: false, error: "Client has not opted in to Telegram or chat ID is missing." }, 400);
  }

  const telegramResponse = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: client.telegram_chat_id,
      text: message,
      disable_web_page_preview: true,
    }),
  });

  const telegramResult = await telegramResponse.json();
  const sent = telegramResponse.ok && telegramResult.ok;
  const deliveryId = crypto.randomUUID();

  await supabase.from("message_deliveries").insert({
    id: deliveryId,
    organization_id: profile.organization_id,
    advisor_id: profile.id,
    client_id: client.id,
    channel: "Telegram",
    subject,
    message,
    status: sent ? "Sent" : "Failed",
    provider_message_id: telegramResult?.result?.message_id ? String(telegramResult.result.message_id) : null,
    error_message: sent ? null : telegramResult?.description ?? "Telegram API rejected the message.",
  });

  await supabase.from("audit_logs").insert({
    id: crypto.randomUUID(),
    organization_id: profile.organization_id,
    actor: profile.full_name,
    action: sent
      ? `Sent Telegram message to ${client.name}: ${subject}`
      : `Telegram message failed for ${client.name}: ${subject}`,
    risk: sent ? "Low" : "Medium",
    time_label: new Date().toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" }),
  });

  if (!sent) {
    return jsonResponse({
      ok: false,
      error: telegramResult?.description ?? "Telegram message failed.",
      deliveryId,
    }, 502);
  }

  return jsonResponse({
    ok: true,
    deliveryId,
    telegramMessageId: telegramResult.result.message_id,
  });
});
