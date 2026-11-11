-- NEXUS initial database schema
-- Apply only after selecting and activating the intended Supabase project.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'New member',
  avatar_url text,
  bio text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(display_name) between 1 and 40)
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint workspaces_name_length check (char_length(name) between 1 and 80)
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text not null default '',
  is_private boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint channels_name_length check (char_length(name) between 1 and 80),
  unique (workspace_id, name)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  constraint messages_content_length check (char_length(content) between 1 and 10000)
);

create index if not exists workspace_members_user_idx on public.workspace_members(user_id);
create index if not exists channels_workspace_idx on public.channels(workspace_id);
create index if not exists messages_channel_created_idx on public.messages(channel_id, created_at desc);
create index if not exists messages_author_idx on public.messages(author_id);

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.channels enable row level security;
alter table public.messages enable row level security;

-- Profiles are visible to signed-in users; only the owner can write their profile.
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);
create policy "profiles_insert_self" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_self" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- A workspace is visible to its owner or a member.
create policy "workspaces_select_member" on public.workspaces
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = id and wm.user_id = (select auth.uid())
    )
  );
create policy "workspaces_insert_owner" on public.workspaces
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "workspaces_update_owner" on public.workspaces
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "workspaces_delete_owner" on public.workspaces
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Members can see their own membership row. Workspace owners can see all rows in their workspace.
create policy "workspace_members_select_self" on public.workspace_members
  for select to authenticated using (user_id = (select auth.uid()));
create policy "workspace_members_insert_self_as_owner" on public.workspace_members
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = (select auth.uid())
    )
  );
create policy "workspace_members_delete_self" on public.workspace_members
  for delete to authenticated using (user_id = (select auth.uid()));

-- Channel access is restricted to workspace members.
create policy "channels_select_workspace_member" on public.channels
  for select to authenticated using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_id and wm.user_id = (select auth.uid())
    )
  );
create policy "channels_insert_workspace_member" on public.channels
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role in ('owner','admin')
    )
  );
create policy "channels_update_creator_or_owner" on public.channels
  for update to authenticated using (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = (select auth.uid())
    )
  ) with check (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = (select auth.uid())
    )
  );
create policy "channels_delete_creator_or_owner" on public.channels
  for delete to authenticated using (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = (select auth.uid())
    )
  );

-- Messages are readable by workspace members; users can only write as themselves.
create policy "messages_select_workspace_member" on public.messages
  for select to authenticated using (
    exists (
      select 1 from public.channels c
      join public.workspace_members wm on wm.workspace_id = c.workspace_id
      where c.id = channel_id and wm.user_id = (select auth.uid())
    )
  );
create policy "messages_insert_self_workspace_member" on public.messages
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.channels c
      join public.workspace_members wm on wm.workspace_id = c.workspace_id
      where c.id = channel_id and wm.user_id = (select auth.uid())
    )
  );
create policy "messages_update_author" on public.messages
  for update to authenticated using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
create policy "messages_delete_author" on public.messages
  for delete to authenticated using (author_id = (select auth.uid()));

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, delete on public.workspace_members to authenticated;
grant select, insert, update, delete on public.channels to authenticated;
grant select, insert, update, delete on public.messages to authenticated;

-- Enable Postgres Changes for real-time chat subscriptions.
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
  when undefined_object then raise notice 'supabase_realtime publication is unavailable; enable it in Supabase Realtime settings.';
end $$;


-- Friend requests
create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friend_requests_not_self check (sender_id <> recipient_id),
  constraint friend_requests_unique_pair unique (sender_id,recipient_id)
);
create index friend_requests_recipient_status_idx on public.friend_requests(recipient_id,status);
create index friend_requests_sender_status_idx on public.friend_requests(sender_id,status);
alter table public.friend_requests enable row level security;
grant select,insert,update,delete on public.friend_requests to authenticated;
create policy "friend_requests_select_participant" on public.friend_requests for select to authenticated
using (sender_id=(select auth.uid()) or recipient_id=(select auth.uid()));
create policy "friend_requests_insert_sender" on public.friend_requests for insert to authenticated
with check (sender_id=(select auth.uid()) and status='pending');
create policy "friend_requests_update_recipient" on public.friend_requests for update to authenticated
using (recipient_id=(select auth.uid()) and status='pending')
with check (recipient_id=(select auth.uid()) and status in ('accepted','rejected'));
create policy "friend_requests_delete_participant" on public.friend_requests for delete to authenticated
using (sender_id=(select auth.uid()) or recipient_id=(select auth.uid()));


-- Private workspace file sharing
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('nexus-files','nexus-files',false,26214400,null)
on conflict (id) do update set public=false,file_size_limit=26214400;

create table if not exists public.workspace_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 255),
  storage_path text not null unique,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null check (size_bytes >= 0 and size_bytes <= 26214400),
  created_at timestamptz not null default now()
);
create index if not exists workspace_files_workspace_created_idx
  on public.workspace_files(workspace_id, created_at desc);
alter table public.workspace_files enable row level security;
grant select,insert,delete on public.workspace_files to authenticated;

drop policy if exists workspace_files_select_member on public.workspace_files;
create policy workspace_files_select_member on public.workspace_files
for select to authenticated using (
  exists (select 1 from public.workspace_members wm
    where wm.workspace_id = workspace_id and wm.user_id = (select auth.uid()))
);
drop policy if exists workspace_files_insert_member on public.workspace_files;
create policy workspace_files_insert_member on public.workspace_files
for insert to authenticated with check (
  uploaded_by = (select auth.uid())
  and exists (select 1 from public.workspace_members wm
    where wm.workspace_id = workspace_id and wm.user_id = (select auth.uid()))
);
drop policy if exists workspace_files_delete_uploader on public.workspace_files;
create policy workspace_files_delete_uploader on public.workspace_files
for delete to authenticated using (uploaded_by = (select auth.uid()));

drop policy if exists nexus_files_read_workspace_member on storage.objects;
create policy nexus_files_read_workspace_member on storage.objects
for select to authenticated using (
  bucket_id = 'nexus-files'
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id::text = (storage.foldername(name))[1]
      and wm.user_id = (select auth.uid())
  )
);
drop policy if exists nexus_files_upload_workspace_member on storage.objects;
create policy nexus_files_upload_workspace_member on storage.objects
for insert to authenticated with check (
  bucket_id = 'nexus-files'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id::text = (storage.foldername(name))[1]
      and wm.user_id = (select auth.uid())
  )
);
drop policy if exists nexus_files_delete_uploader on storage.objects;
create policy nexus_files_delete_uploader on storage.objects
for delete to authenticated using (
  bucket_id = 'nexus-files'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);


-- Workspace invitations. Invitation creation is server-only through the invite-workspace-member Edge Function.
create table if not exists public.workspace_invites (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 email text not null,
 invited_by uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted','expired','cancelled')),
 expires_at timestamptz not null default now() + interval '7 days',
 created_at timestamptz not null default now(),
 accepted_by uuid references auth.users(id) on delete set null,
 accepted_at timestamptz,
 constraint workspace_invites_email_format check (position('@' in email)>1)
);
create index if not exists workspace_invites_workspace_created_idx on public.workspace_invites(workspace_id,created_at desc);
create index if not exists workspace_invites_email_status_idx on public.workspace_invites(lower(email),status);
create unique index if not exists workspace_invites_one_pending_email on public.workspace_invites(workspace_id,lower(email)) where status='pending';
alter table public.workspace_invites enable row level security;
grant select on public.workspace_invites to authenticated;
create policy workspace_invites_select_owner_or_invitee on public.workspace_invites for select to authenticated using (
 lower(email)=lower(coalesce(auth.jwt()->>'email',''))
 or exists(select 1 from public.workspace_members wm where wm.workspace_id=workspace_id and wm.user_id=(select auth.uid()) and wm.role in ('owner','admin'))
 or exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid()))
);
revoke insert,update,delete on public.workspace_invites from anon,authenticated;
create or replace function private.accept_workspace_invite(p_invite_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_inv public.workspace_invites%rowtype; v_email text;
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
 v_email := lower(coalesce(auth.jwt()->>'email',''));
 if v_email = '' then raise exception '인증된 이메일을 확인할 수 없습니다.'; end if;
 select * into v_inv from public.workspace_invites where id=p_invite_id for update;
 if not found then raise exception '초대를 찾을 수 없습니다.'; end if;
 if lower(v_inv.email) <> v_email then raise exception '초대받은 이메일 계정으로 로그인해야 합니다.'; end if;
 if v_inv.status <> 'pending' then raise exception '이미 처리된 초대입니다.'; end if;
 if v_inv.expires_at <= now() then update public.workspace_invites set status='expired' where id=p_invite_id; raise exception '초대가 만료되었습니다.'; end if;
 insert into public.workspace_members(workspace_id,user_id,role) values(v_inv.workspace_id,auth.uid(),'member') on conflict(workspace_id,user_id) do nothing;
 update public.workspace_invites set status='accepted',accepted_by=auth.uid(),accepted_at=now() where id=p_invite_id;
 return jsonb_build_object('ok',true,'workspace_id',v_inv.workspace_id);
end; $$;
revoke all on function private.accept_workspace_invite(uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.accept_workspace_invite(uuid) to authenticated;
create or replace function public.accept_workspace_invite(p_invite_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$ select private.accept_workspace_invite(p_invite_id); $$;
revoke all on function public.accept_workspace_invite(uuid) from public,anon;
grant execute on function public.accept_workspace_invite(uuid) to authenticated;

create schema if not exists private;
create or replace function private.is_workspace_admin(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $
 select exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=(select auth.uid()) and wm.role in ('owner','admin'));
$;
revoke all on function private.is_workspace_admin(uuid) from public,anon;
grant execute on function private.is_workspace_admin(uuid) to authenticated;
drop policy if exists workspace_members_select_owner_admin on public.workspace_members;
create policy workspace_members_select_owner_admin on public.workspace_members for select to authenticated using (
 private.is_workspace_admin(workspace_id)
 or exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid()))
);

-- NEXUS corrective policies: bind every membership check to the row's workspace.
create or replace function private.is_workspace_member(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_workspace_member(uuid) from public, anon;
grant execute on function private.is_workspace_member(uuid) to authenticated;

drop policy if exists workspace_members_select_owner_admin on public.workspace_members;
drop policy if exists workspace_members_select_self on public.workspace_members;
drop policy if exists workspace_members_select_workspace_member on public.workspace_members;
create policy workspace_members_select_workspace_member on public.workspace_members
for select to authenticated using (private.is_workspace_member(workspace_id));

drop policy if exists workspace_files_select_member on public.workspace_files;
create policy workspace_files_select_member on public.workspace_files
for select to authenticated using (
  exists (select 1 from public.workspace_members wm
    where wm.workspace_id = workspace_files.workspace_id
      and wm.user_id = (select auth.uid()))
);
drop policy if exists workspace_files_insert_member on public.workspace_files;
create policy workspace_files_insert_member on public.workspace_files
for insert to authenticated with check (
  uploaded_by = (select auth.uid())
  and exists (select 1 from public.workspace_members wm
    where wm.workspace_id = workspace_files.workspace_id
      and wm.user_id = (select auth.uid()))
);

drop policy if exists workspace_invites_select_owner_or_invitee on public.workspace_invites;
create policy workspace_invites_select_owner_or_invitee on public.workspace_invites
for select to authenticated using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email',''))
  or exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = workspace_invites.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role in ('owner','admin')
  )
  or exists (
    select 1 from public.workspaces w
    where w.id = workspace_invites.workspace_id
      and w.owner_id = (select auth.uid())
  )
);

-- Profile fields used by the current mobile client.
alter table public.profiles
  add column if not exists status_text text not null default '',
  add column if not exists theme_color text not null default '#7867e8',
  add column if not exists last_seen_at timestamptz;


-- Persisted workspace meeting schedule.
create table if not exists public.scheduled_meetings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  starts_at timestamptz not null,
  meeting_code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),
  created_at timestamptz not null default now()
);
create index if not exists scheduled_meetings_workspace_start_idx on public.scheduled_meetings(workspace_id,starts_at);
alter table public.scheduled_meetings enable row level security;
grant select,insert,delete on public.scheduled_meetings to authenticated;
drop policy if exists scheduled_meetings_select_member on public.scheduled_meetings;
create policy scheduled_meetings_select_member on public.scheduled_meetings
for select to authenticated using (private.is_workspace_member(workspace_id));
drop policy if exists scheduled_meetings_insert_member on public.scheduled_meetings;
create policy scheduled_meetings_insert_member on public.scheduled_meetings
for insert to authenticated with check (created_by=(select auth.uid()) and private.is_workspace_member(workspace_id));
drop policy if exists scheduled_meetings_delete_creator on public.scheduled_meetings;
create policy scheduled_meetings_delete_creator on public.scheduled_meetings
for delete to authenticated using (created_by=(select auth.uid()) or private.is_workspace_admin(workspace_id));

-- Performance-safe policy expressions used by the live project.
drop policy if exists dm_conversations_select_member on public.dm_conversations;
create policy dm_conversations_select_member on public.dm_conversations
for select to authenticated using ((select auth.uid())=member_one or (select auth.uid())=member_two);
drop policy if exists dm_conversations_insert_friends on public.dm_conversations;
create policy dm_conversations_insert_friends on public.dm_conversations
for insert to authenticated with check (
  ((select auth.uid())=member_one or (select auth.uid())=member_two)
  and exists (
    select 1 from public.friend_requests f where f.status='accepted'
      and ((f.sender_id=dm_conversations.member_one and f.recipient_id=dm_conversations.member_two)
        or (f.sender_id=dm_conversations.member_two and f.recipient_id=dm_conversations.member_one))
  )
);
drop policy if exists dm_messages_select_member on public.dm_messages;
create policy dm_messages_select_member on public.dm_messages
for select to authenticated using (
  exists(select 1 from public.dm_conversations c where c.id=dm_messages.conversation_id
    and ((select auth.uid())=c.member_one or (select auth.uid())=c.member_two))
);
drop policy if exists dm_messages_insert_sender on public.dm_messages;
create policy dm_messages_insert_sender on public.dm_messages
for insert to authenticated with check (
  sender_id=(select auth.uid())
  and exists(select 1 from public.dm_conversations c where c.id=dm_messages.conversation_id
    and ((select auth.uid())=c.member_one or (select auth.uid())=c.member_two))
);
drop policy if exists notifications_select_self on public.notifications;
create policy notifications_select_self on public.notifications
for select to authenticated using (recipient_id=(select auth.uid()));
drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self on public.notifications
for update to authenticated using (recipient_id=(select auth.uid()))
with check (recipient_id=(select auth.uid()));
drop policy if exists push_subscriptions_select_self on public.push_subscriptions;
create policy push_subscriptions_select_self on public.push_subscriptions
for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists push_subscriptions_insert_self on public.push_subscriptions;
create policy push_subscriptions_insert_self on public.push_subscriptions
for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists push_subscriptions_delete_self on public.push_subscriptions;
create policy push_subscriptions_delete_self on public.push_subscriptions
for delete to authenticated using (user_id=(select auth.uid()));
drop policy if exists workspace_invites_select_owner_or_invitee on public.workspace_invites;
create policy workspace_invites_select_owner_or_invitee on public.workspace_invites
for select to authenticated using (
  lower(email)=lower(coalesce((select auth.jwt())->>'email',''))
  or exists(select 1 from public.workspace_members wm where wm.workspace_id=workspace_invites.workspace_id
    and wm.user_id=(select auth.uid()) and wm.role in ('owner','admin'))
  or exists(select 1 from public.workspaces w where w.id=workspace_invites.workspace_id and w.owner_id=(select auth.uid()))
);

create index if not exists channels_created_by_idx on public.channels(created_by);
create index if not exists dm_conversations_member_two_idx on public.dm_conversations(member_two);
create index if not exists dm_messages_sender_id_idx on public.dm_messages(sender_id);
create index if not exists notifications_actor_id_idx on public.notifications(actor_id);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
create index if not exists scheduled_meetings_created_by_idx on public.scheduled_meetings(created_by);
create index if not exists workspace_files_uploaded_by_idx on public.workspace_files(uploaded_by);
create index if not exists workspace_invites_accepted_by_idx on public.workspace_invites(accepted_by);
create index if not exists workspace_invites_invited_by_idx on public.workspace_invites(invited_by);
create index if not exists workspaces_owner_id_idx on public.workspaces(owner_id);


-- NEXUS reliability/security follow-up (notification delivery and role escalation guard).
alter table public.notifications add column if not exists source_id uuid;
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array['friend_request','dm','mention','ping','call','admin']::text[]));

drop policy if exists notifications_insert_actor on public.notifications;
create policy notifications_insert_actor
on public.notifications for insert to authenticated
with check (
  actor_id = (select auth.uid())
  and recipient_id <> (select auth.uid())
  and (
    (type in ('dm','ping','call') and exists (
      select 1 from public.dm_conversations c
      where c.id = notifications.target_id
        and (c.member_one = (select auth.uid()) or c.member_two = (select auth.uid()))
        and (c.member_one = notifications.recipient_id or c.member_two = notifications.recipient_id)
    ))
    or (type = 'mention' and exists (
      select 1 from public.messages m
      join public.channels c on c.id = m.channel_id
      join public.workspace_members sender_member
        on sender_member.workspace_id = c.workspace_id and sender_member.user_id = (select auth.uid())
      join public.workspace_members recipient_member
        on recipient_member.workspace_id = c.workspace_id and recipient_member.user_id = notifications.recipient_id
      join public.profiles p on p.id = notifications.recipient_id
      where m.id = notifications.source_id
        and m.channel_id = notifications.target_id
        and m.author_id = (select auth.uid())
        and position(lower('@' || p.display_name) in lower(m.content)) > 0
    ))
    or (type = 'friend_request' and exists (
      select 1 from public.friend_requests fr
      where fr.id = notifications.source_id
        and fr.sender_id = (select auth.uid())
        and fr.recipient_id = notifications.recipient_id
        and fr.status = 'pending'
    ))
  )
);

create or replace function private.can_define_workspace_role(p_workspace_id uuid,p_permissions jsonb)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_workspace_admin(p_workspace_id)
    or (
      (select auth.uid()) is not null
      and jsonb_typeof(coalesce(p_permissions, '{}'::jsonb)) = 'object'
      and not exists (
        select 1 from jsonb_each_text(coalesce(p_permissions, '{}'::jsonb)) requested
        where requested.value = 'true'
          and not exists (
            select 1 from public.workspace_member_roles mr
            join public.workspace_roles r on r.id=mr.role_id and r.workspace_id=mr.workspace_id
            where mr.workspace_id=p_workspace_id and mr.user_id=(select auth.uid())
              and coalesce((r.permissions->>requested.key)::boolean,false)
          )
      )
    );
$$;
revoke all on function private.can_define_workspace_role(uuid,jsonb) from public,anon;
grant execute on function private.can_define_workspace_role(uuid,jsonb) to authenticated;

create or replace function private.can_assign_workspace_role(p_workspace_id uuid,p_user_id uuid,p_role_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_roles r
    join public.workspace_members target_member
      on target_member.workspace_id=r.workspace_id and target_member.user_id=p_user_id
    where r.id=p_role_id and r.workspace_id=p_workspace_id
      and private.can_define_workspace_role(p_workspace_id,r.permissions)
  );
$$;
revoke all on function private.can_assign_workspace_role(uuid,uuid,uuid) from public,anon;
grant execute on function private.can_assign_workspace_role(uuid,uuid,uuid) to authenticated;

drop policy if exists workspace_roles_insert_admin on public.workspace_roles;
drop policy if exists workspace_roles_update_admin on public.workspace_roles;
drop policy if exists workspace_roles_delete_admin on public.workspace_roles;
create policy workspace_roles_insert_admin on public.workspace_roles for insert to authenticated
with check (private.has_workspace_permission(workspace_id,'manage_roles')
  and created_by=(select auth.uid()) and private.can_define_workspace_role(workspace_id,permissions));
create policy workspace_roles_update_admin on public.workspace_roles for update to authenticated
using (private.has_workspace_permission(workspace_id,'manage_roles'))
with check (private.has_workspace_permission(workspace_id,'manage_roles')
  and private.can_define_workspace_role(workspace_id,permissions));
create policy workspace_roles_delete_admin on public.workspace_roles for delete to authenticated
using (private.has_workspace_permission(workspace_id,'manage_roles'));

drop policy if exists workspace_member_roles_insert_admin on public.workspace_member_roles;
drop policy if exists workspace_member_roles_update_admin on public.workspace_member_roles;
drop policy if exists workspace_member_roles_delete_admin on public.workspace_member_roles;
create policy workspace_member_roles_insert_admin on public.workspace_member_roles for insert to authenticated
with check (assigned_by=(select auth.uid())
  and private.has_workspace_permission(workspace_id,'manage_roles')
  and private.can_assign_workspace_role(workspace_id,user_id,role_id));
create policy workspace_member_roles_update_admin on public.workspace_member_roles for update to authenticated
using (private.has_workspace_permission(workspace_id,'manage_roles'))
with check (assigned_by=(select auth.uid())
  and private.has_workspace_permission(workspace_id,'manage_roles')
  and private.can_assign_workspace_role(workspace_id,user_id,role_id));
create policy workspace_member_roles_delete_admin on public.workspace_member_roles for delete to authenticated
using (private.has_workspace_permission(workspace_id,'manage_roles'));

create index if not exists message_reactions_user_id_idx on public.message_reactions(user_id);
create index if not exists workspace_join_links_created_by_idx on public.workspace_join_links(created_by);
create index if not exists workspace_member_roles_user_id_idx on public.workspace_member_roles(user_id);
create index if not exists workspace_member_roles_role_id_idx on public.workspace_member_roles(role_id);
create index if not exists workspace_member_roles_assigned_by_idx on public.workspace_member_roles(assigned_by);
create index if not exists workspace_roles_created_by_idx on public.workspace_roles(created_by);

drop policy if exists message_reactions_insert_self_member on public.message_reactions;
create policy message_reactions_insert_self_member on public.message_reactions for insert to authenticated
with check (user_id=(select auth.uid()) and exists (
  select 1 from public.messages m join public.channels c on c.id=m.channel_id
  where m.id=message_reactions.message_id and private.is_workspace_member(c.workspace_id)
));
drop policy if exists message_reactions_delete_self on public.message_reactions;
create policy message_reactions_delete_self on public.message_reactions for delete to authenticated
using (user_id=(select auth.uid()));



-- NEXUS active-session and aggregate usage telemetry. No message content or personal data is collected.
create table if not exists public.app_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, session_id)
);
alter table public.app_sessions enable row level security;
drop policy if exists app_sessions_select_self on public.app_sessions;
create policy app_sessions_select_self on public.app_sessions for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists app_sessions_insert_self on public.app_sessions;
create policy app_sessions_insert_self on public.app_sessions for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists app_sessions_update_self on public.app_sessions;
create policy app_sessions_update_self on public.app_sessions for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create table if not exists public.app_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('app_open','message_sent','dm_sent','call_started','file_uploaded')),
  created_at timestamptz not null default now()
);
alter table public.app_usage_events enable row level security;
drop policy if exists app_usage_events_select_self on public.app_usage_events;
create policy app_usage_events_select_self on public.app_usage_events for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists app_usage_events_insert_self on public.app_usage_events;
create policy app_usage_events_insert_self on public.app_usage_events for insert to authenticated with check (user_id=(select auth.uid()));

create index if not exists app_sessions_last_seen_idx on public.app_sessions(last_seen_at desc);
create index if not exists app_usage_events_created_idx on public.app_usage_events(created_at desc);
create index if not exists app_usage_events_type_created_idx on public.app_usage_events(event_type,created_at desc);
create index if not exists app_usage_events_user_created_idx on public.app_usage_events(user_id,created_at desc);

-- Explicit deny policies document that these tables are accessible only to trusted server functions.
drop policy if exists admin_audit_logs_server_only on public.admin_audit_logs;
create policy admin_audit_logs_server_only on public.admin_audit_logs for all to anon,authenticated using(false) with check(false);
drop policy if exists push_vapid_config_server_only on public.push_vapid_config;
create policy push_vapid_config_server_only on public.push_vapid_config for all to anon,authenticated using(false) with check(false);
drop policy if exists system_announcements_server_only on public.system_announcements;
create policy system_announcements_server_only on public.system_announcements for all to anon,authenticated using(false) with check(false);
drop policy if exists workspace_join_links_server_only on public.workspace_join_links;
create policy workspace_join_links_server_only on public.workspace_join_links for all to anon,authenticated using(false) with check(false);



-- Search acceleration and server-enforced daily AI request budget.
create extension if not exists pg_trgm with schema extensions;
create index if not exists messages_content_trgm_idx on public.messages using gin (content extensions.gin_trgm_ops);
create index if not exists dm_messages_content_trgm_idx on public.dm_messages using gin (content extensions.gin_trgm_ops);
create index if not exists profiles_display_name_trgm_idx on public.profiles using gin (display_name extensions.gin_trgm_ops);

create table if not exists public.ai_request_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, usage_day)
);
alter table public.ai_request_usage enable row level security;
drop policy if exists ai_request_usage_server_only on public.ai_request_usage;
create policy ai_request_usage_server_only on public.ai_request_usage for all to anon,authenticated using(false) with check(false);

create or replace function public.consume_ai_request_limit(p_user_id uuid,p_daily_limit integer default 60)
returns table(allowed boolean,remaining integer,reset_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_count integer; v_limit integer:=greatest(1,least(coalesce(p_daily_limit,60),120)); v_day date:=(now() at time zone 'UTC')::date;
begin
  if p_user_id is null then return query select false,0,((v_day+1)::timestamp at time zone 'UTC'); return; end if;
  insert into public.ai_request_usage(user_id,usage_day,request_count) values(p_user_id,v_day,1)
  on conflict(user_id,usage_day) do update set request_count=public.ai_request_usage.request_count+1
  where public.ai_request_usage.request_count<v_limit returning request_count into v_count;
  if v_count is null then return query select false,0,((v_day+1)::timestamp at time zone 'UTC');
  else return query select true,greatest(0,v_limit-v_count),((v_day+1)::timestamp at time zone 'UTC'); end if;
end;
$$;
revoke all on function public.consume_ai_request_limit(uuid,integer) from public,anon,authenticated;
grant execute on function public.consume_ai_request_limit(uuid,integer) to service_role;
