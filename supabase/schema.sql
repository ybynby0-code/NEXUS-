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
