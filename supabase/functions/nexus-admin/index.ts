import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = "https://ybynby0-code.github.io";
const cors = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Vary": "Origin",
};
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (req: Request) => {
  if (req.headers.get("origin") !== allowedOrigin) return reply(403, { ok: false, error: "허용되지 않은 출처입니다." });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { ok: false, error: "Method not allowed" });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return reply(500, { ok: false, error: "서버 환경 변수가 설정되지 않았습니다." });

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { ok: false, error: "로그인이 필요합니다." });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return reply(401, { ok: false, error: "인증 정보가 유효하지 않습니다." });
  const actor = authData.user;
  const { data: roleRow } = await admin.from("app_admins").select("role").eq("user_id", actor.id).maybeSingle();
  if (!roleRow || !["developer", "admin", "moderator"].includes(roleRow.role)) {
    return reply(403, { ok: false, error: "관리자 권한이 없습니다." });
  }
  const role = roleRow.role as string;
  let input: any;
  try { input = await req.json(); } catch { return reply(400, { ok: false, error: "요청 형식이 올바르지 않습니다." }); }
  const action = String(input.action || "");
  const developerOnly = new Set(["set_role", "suspend_user", "unsuspend_user", "delete_message"]);
  if (developerOnly.has(action) && role !== "developer") return reply(403, { ok: false, error: "개발자 권한이 필요한 작업입니다." });

  const audit = async (details: Record<string, unknown> = {}, targetId: string | null = null) => {
    await admin.from("admin_audit_logs").insert({ actor_id: actor.id, action, target_id: targetId, details });
  };

  try {
    if (action === "overview") {
      const [users, workspaces, messages, files, invites] = await Promise.all([
        admin.auth.admin.listUsers({ page: 1, perPage: 1 }),
        admin.from("workspaces").select("id", { count: "exact", head: true }),
        admin.from("messages").select("id", { count: "exact", head: true }),
        admin.from("workspace_files").select("id", { count: "exact", head: true }),
        admin.from("workspace_invites").select("id", { count: "exact", head: true }),
      ]);
      return reply(200, { ok: true, role, stats: { users: users.data?.total ?? null, workspaces: workspaces.count, messages: messages.count, files: files.count, invites: invites.count } });
    }
    if (action === "users") {
      const page = Math.max(1, Number(input.page) || 1);
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw error;
      const ids = (data.users || []).map((u: any) => u.id);
      const [profiles, roles] = await Promise.all([
        ids.length ? admin.from("profiles").select("id,display_name,avatar_url,last_seen_at").in("id", ids) : Promise.resolve({ data: [] }),
        ids.length ? admin.from("app_admins").select("user_id,role").in("user_id", ids) : Promise.resolve({ data: [] }),
      ]);
      const profileMap = new Map((profiles.data || []).map((p: any) => [p.id, p]));
      const roleMap = new Map((roles.data || []).map((r: any) => [r.user_id, r.role]));
      const rows = (data.users || []).map((u: any) => ({
        id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at,
        banned_until: u.banned_until, display_name: (profileMap.get(u.id) as any)?.display_name || u.email,
        last_seen_at: (profileMap.get(u.id) as any)?.last_seen_at, role: roleMap.get(u.id) || "user",
      }));
      return reply(200, { ok: true, users: rows, total: data.total ?? null, page });
    }
    if (action === "user_details") {
      const id = String(input.user_id || "");
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error) throw error;
      const [profile, membership] = await Promise.all([
        admin.from("profiles").select("*").eq("id", id).maybeSingle(),
        admin.from("workspace_members").select("workspace_id,role,joined_at").eq("user_id", id),
      ]);
      return reply(200, { ok: true, user: { id: data.user.id, email: data.user.email, created_at: data.user.created_at, last_sign_in_at: data.user.last_sign_in_at, banned_until: data.user.banned_until }, profile: profile.data, memberships: membership.data || [] });
    }
    if (action === "suspend_user" || action === "unsuspend_user") {
      const id = String(input.user_id || "");
      if (!id || id === actor.id) return reply(400, { ok: false, error: "본인 계정은 이 작업의 대상이 될 수 없습니다." });
      const { data: targetRole, error: targetRoleError } = await admin.from("app_admins").select("role").eq("user_id", id).maybeSingle();
      if (targetRoleError) throw targetRoleError;
      if (targetRole?.role === "developer") return reply(403, { ok: false, error: "개발자 계정은 다른 관리자가 정지할 수 없습니다." });
      const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: action === "suspend_user" ? "876000h" : "none" });
      if (error) throw error;
      await audit({ suspended: action === "suspend_user" }, id);
      return reply(200, { ok: true });
    }
    if (action === "set_role") {
      const id = String(input.user_id || "");
      const nextRole = String(input.role || "user");
      if (!id || id === actor.id || !["user", "admin", "moderator"].includes(nextRole)) return reply(400, { ok: false, error: "역할 변경 요청이 올바르지 않습니다." });
      const { data: targetRole, error: targetRoleError } = await admin.from("app_admins").select("role").eq("user_id", id).maybeSingle();
      if (targetRoleError) throw targetRoleError;
      if (targetRole?.role === "developer") return reply(403, { ok: false, error: "개발자 계정의 권한은 변경할 수 없습니다." });
      if (nextRole === "user") {
        const { error } = await admin.from("app_admins").delete().eq("user_id", id).neq("role", "developer");
        if (error) throw error;
      } else {
        const { error } = await admin.from("app_admins").upsert({ user_id: id, role: nextRole }, { onConflict: "user_id" });
        if (error) throw error;
      }
      await audit({ role: nextRole }, id);
      return reply(200, { ok: true });
    }
    if (action === "announcement") {
      const title = String(input.title || "").trim().slice(0, 100);
      const body = String(input.body || "").trim().slice(0, 2000);
      if (!title || !body) return reply(400, { ok: false, error: "제목과 내용을 입력해 주세요." });
      const { data, error } = await admin.from("system_announcements").insert({ title, body, created_by: actor.id }).select().single();
      if (error) throw error;
      await audit({ title }, data.id);
      return reply(200, { ok: true, announcement: data });
    }
    if (action === "target_notification") {
      const userId = String(input.user_id || "");
      const title = String(input.title || "").trim().slice(0, 100);
      const body = String(input.body || "").trim().slice(0, 1000);
      if (!userId || !title || !body) return reply(400, { ok: false, error: "대상 사용자, 제목, 내용을 입력해 주세요." });
      const { error } = await admin.from("notifications").insert({ recipient_id: userId, actor_id: actor.id, type: "admin", title, body });
      if (error) throw error;
      await audit({ title }, userId);
      return reply(200, { ok: true });
    }
    if (action === "workspaces") {
      const { data, error } = await admin.from("workspaces").select("id,name,owner_id,created_at").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return reply(200, { ok: true, workspaces: data || [] });
    }
    if (action === "channels") {
      const { data, error } = await admin.from("channels").select("id,name,workspace_id,created_at").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return reply(200, { ok: true, channels: data || [] });
    }
    if (action === "invites") {
      const { data, error } = await admin.from("workspace_invites").select("id,email,status,workspace_id,created_at,expires_at").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return reply(200, { ok: true, invites: data || [] });
    }
    if (action === "files") {
      const { data, error } = await admin.from("workspace_files").select("id,file_name,workspace_id,uploaded_by,size_bytes,created_at").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return reply(200, { ok: true, files: data || [] });
    }
    if (action === "delete_message") {
      const id = String(input.message_id || "");
      const { error } = await admin.from("messages").delete().eq("id", id);
      if (error) throw error;
      await audit({}, id);
      return reply(200, { ok: true });
    }
    if (action === "audit_logs") {
      const { data, error } = await admin.from("admin_audit_logs").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return reply(200, { ok: true, logs: data || [] });
    }
    if (action === "health") {
      const checks = await Promise.all([
        admin.from("profiles").select("id", { count: "exact", head: true }),
        admin.from("messages").select("id", { count: "exact", head: true }),
        admin.from("workspaces").select("id", { count: "exact", head: true }),
      ]);
      return reply(200, { ok: checks.every((x: any) => !x.error), checks: checks.map((x: any, i: number) => ({ name: ["profiles", "messages", "workspaces"][i], ok: !x.error, count: x.count, error: x.error?.message })) });
    }
    return reply(400, { ok: false, error: "지원하지 않는 관리자 작업입니다." });
  } catch (error) {
    console.error("[nexus-admin]", error);
    return reply(500, { ok: false, error: error instanceof Error ? error.message : "관리자 요청 처리 실패" });
  }
});