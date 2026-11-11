import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const allowedOrigin = "https://ybynby0-code.github.io";
const cors = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

async function getOrCreateVapid(admin: ReturnType<typeof createClient>) {
  const { data: existing, error } = await admin.from("push_vapid_config")
    .select("public_key,private_key").eq("singleton", true).maybeSingle();
  if (error) throw error;
  if (existing) return existing;
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  if (!privateJwk.d) throw new Error("VAPID 개인 키를 생성하지 못했습니다.");
  const keys = { public_key: b64url(publicRaw), private_key: privateJwk.d };
  const { error: insertError } = await admin.from("push_vapid_config").insert({ singleton: true, ...keys });
  if (insertError) {
    const { data: raced, error: racedError } = await admin.from("push_vapid_config")
      .select("public_key,private_key").eq("singleton", true).maybeSingle();
    if (racedError || !raced) throw insertError;
    return raced;
  }
  return keys;
}
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.headers.get("origin") !== allowedOrigin) return json({ ok: false, error: "허용되지 않은 출처입니다." }, 403);
  if (req.method !== "POST") return json({ ok: false, error: "POST 요청만 허용됩니다." }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization") || "";
    if (!url || !anon || !serviceKey || !authHeader.startsWith("Bearer ")) {
      return json({ ok: false, error: "로그인이 필요합니다." }, 401);
    }
    const authClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error: authError } = await authClient.auth.getUser();
    if (authError || !auth.user) return json({ ok: false, error: "인증 정보가 유효하지 않습니다." }, 401);
    const user = auth.user;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const input = await req.json();
    if (input.action === "public_key") {
      const keys = await getOrCreateVapid(admin);
      return json({ ok: true, public_key: keys.public_key });
    }
    if (input.action === "test") {
      const keys = await getOrCreateVapid(admin);
      if (!keys?.public_key || !keys?.private_key) throw new Error("VAPID 키 설정이 완전하지 않습니다.");
      webpush.setVapidDetails("mailto:noreply@nexus.app", keys.public_key, keys.private_key);
      const { data: devices, error: deviceError } = await admin.from("push_subscriptions")
        .select("id,endpoint,p256dh,auth").eq("user_id", user.id);
      if (deviceError) throw deviceError;
      let sent = 0;
      const stale: string[] = [];
      const payload = JSON.stringify({ title: "NEXUS 테스트 알림", body: "백그라운드 푸시 알림이 정상적으로 연결되었습니다.", tag: "nexus-push-test-" + Date.now(), url: "/NEXUS-/?section=home", vibrate: [180, 90, 180] });
      for (const device of devices || []) {
        try {
          await webpush.sendNotification({ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } }, payload);
          sent++;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) stale.push(device.id);
          else console.error("[NEXUS push test delivery]", error);
        }
      }
      if (stale.length) await admin.from("push_subscriptions").delete().in("id", stale);
      return json({ ok: true, sent, kind: "test" });
    }

    const kind = String(input.kind || "dm");
    const recipientId = String(input.recipient_id || "");
    const title = String(input.title || "").trim();
    const body = String(input.body || "").trim();
    const conversationId = String(input.conversation_id || "");
    const resourceId = String(input.resource_id || "");
    if (!recipientId || recipientId === user.id || !title || !body) {
      return json({ ok: false, error: "알림 대상과 제목·내용을 확인해 주세요." }, 400);
    }
    if (title.length > 80 || body.length > 240) return json({ ok: false, error: "알림 제목 또는 내용이 너무 깁니다." }, 413);
    if (!["dm", "ping", "call", "mention", "friend_request"].includes(kind)) {
      return json({ ok: false, error: "지원하지 않는 알림 유형입니다." }, 400);
    }

    if (kind === "mention") {
      if (!conversationId || !resourceId) return json({ ok: false, error: "멘션 메시지 정보가 누락되었습니다." }, 400);
      const [{ data: message }, { data: channel }, { data: recipientProfile }] = await Promise.all([
        admin.from("messages").select("id,channel_id,author_id,content").eq("id", resourceId).maybeSingle(),
        admin.from("channels").select("id,workspace_id").eq("id", conversationId).maybeSingle(),
        admin.from("profiles").select("display_name").eq("id", recipientId).maybeSingle(),
      ]);
      if (!message || !channel || !recipientProfile || message.author_id !== user.id || message.channel_id !== conversationId) {
        return json({ ok: false, error: "멘션 메시지를 확인할 수 없습니다." }, 403);
      }
      const nickname = String(recipientProfile.display_name || "").trim();
      const mentionPattern = nickname ? new RegExp("(^|\\s)@" + escapeRegExp(nickname) + "(?=$|[\\s.,!?)]|$)", "iu") : null;
      if (!mentionPattern || !mentionPattern.test(String(message.content || ""))) {
        return json({ ok: false, error: "메시지에 해당 사용자의 멘션이 없습니다." }, 403);
      }
      const { data: memberships, error: membershipError } = await admin.from("workspace_members")
        .select("user_id").eq("workspace_id", channel.workspace_id).in("user_id", [user.id, recipientId]);
      if (membershipError) throw membershipError;
      const memberIds = new Set((memberships || []).map((row: any) => row.user_id));
      if (!memberIds.has(user.id) || !memberIds.has(recipientId)) {
        return json({ ok: false, error: "해당 채널의 멤버만 멘션 알림을 보낼 수 있습니다." }, 403);
      }
    } else if (kind === "friend_request") {
      if (!resourceId) return json({ ok: false, error: "친구 요청 정보가 누락되었습니다." }, 400);
      const { data: request, error } = await admin.from("friend_requests")
        .select("id,sender_id,recipient_id,status").eq("id", resourceId).maybeSingle();
      if (error) throw error;
      if (!request || request.sender_id !== user.id || request.recipient_id !== recipientId || request.status !== "pending") {
        return json({ ok: false, error: "유효한 친구 요청이 아닙니다." }, 403);
      }
    } else {
      if (!conversationId) return json({ ok: false, error: "대화 정보가 누락되었습니다." }, 400);
      const { data: conversation, error } = await admin.from("dm_conversations")
        .select("id,member_one,member_two,is_group").eq("id", conversationId).maybeSingle();
      if (error) throw error;
      if (!conversation) return json({ ok: false, error: "대화를 찾을 수 없습니다." }, 403);
      if (conversation.is_group) {
        const { data: members, error: memberError } = await admin.from("dm_conversation_members")
          .select("user_id").eq("conversation_id", conversationId).in("user_id", [user.id, recipientId]);
        if (memberError) throw memberError;
        const memberIds = new Set((members || []).map((row: any) => row.user_id));
        if (!memberIds.has(user.id) || !memberIds.has(recipientId)) {
          return json({ ok: false, error: "그룹 대화 참여자에게만 알림을 보낼 수 있습니다." }, 403);
        }
      } else if (![conversation.member_one, conversation.member_two].includes(user.id) ||
        ![conversation.member_one, conversation.member_two].includes(recipientId)) {
        return json({ ok: false, error: "이 대화의 참여자에게만 알림을 보낼 수 있습니다." }, 403);
      }
    }

    const keys = await getOrCreateVapid(admin);
    if (!keys?.public_key || !keys?.private_key) throw new Error("VAPID 키 설정이 완전하지 않습니다.");
    webpush.setVapidDetails("mailto:noreply@nexus.app", keys.public_key, keys.private_key);
    const { data: rows, error: rowsError } = await admin.from("push_subscriptions")
      .select("id,endpoint,p256dh,auth").eq("user_id", recipientId);
    if (rowsError) throw rowsError;

    let notificationUrl = "/NEXUS-/?section=dms";
    if (typeof input.url === "string") {
      const parsedTarget = new URL(input.url, allowedOrigin + "/NEXUS-/");
      if (parsedTarget.origin !== allowedOrigin || !parsedTarget.pathname.startsWith("/NEXUS-/")) {
        return json({ ok: false, error: "알림 이동 주소가 올바르지 않습니다." }, 400);
      }
      notificationUrl = parsedTarget.pathname + parsedTarget.search + parsedTarget.hash;
    }
    const safeTag = typeof input.tag === "string" && /^[a-zA-Z0-9:_-]{1,120}$/.test(input.tag)
      ? input.tag : "nexus-" + kind + "-" + resourceId;
    const payload = JSON.stringify({
      title, body, tag: safeTag, url: notificationUrl,
      vibrate: [260, 100, 260, 100, 420],
    });
    let sent = 0;
    const stale: string[] = [];
    for (const row of rows || []) {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          payload,
        );
        sent++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) stale.push(row.id);
        else console.error("[NEXUS push delivery]", error);
      }
    }
    if (stale.length) await admin.from("push_subscriptions").delete().in("id", stale);
    return json({ ok: true, sent, kind });
  } catch (error) {
    console.error("[NEXUS push]", error);
    return json({ ok: false, error: error instanceof Error ? error.message : "푸시 전송에 실패했습니다." }, 500);
  }
});
