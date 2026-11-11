-- NEXUS Discord-style channel foundation (idempotent)
create table if not exists public.workspace_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  position integer not null default 0,
  collapsed boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists workspace_categories_order_idx on public.workspace_categories(workspace_id, position, created_at);
alter table public.workspace_categories enable row level security;
grant select, insert, update, delete on public.workspace_categories to authenticated;
drop policy if exists workspace_categories_select_member on public.workspace_categories;
create policy workspace_categories_select_member on public.workspace_categories for select to authenticated using (private.is_workspace_member(workspace_id));
drop policy if exists workspace_categories_manage on public.workspace_categories;
create policy workspace_categories_manage on public.workspace_categories for all to authenticated using (private.has_workspace_permission(workspace_id,'manage_channels')) with check (private.has_workspace_permission(workspace_id,'manage_channels') and created_by=(select auth.uid()));

alter table public.channels
  add column if not exists category_id uuid references public.workspace_categories(id) on delete set null,
  add column if not exists channel_type text not null default 'text',
  add column if not exists topic text not null default '',
  add column if not exists position integer not null default 0,
  add column if not exists slowmode_seconds integer not null default 0,
  add column if not exists is_nsfw boolean not null default false;
alter table public.channels drop constraint if exists channels_channel_type_check;
alter table public.channels add constraint channels_channel_type_check check (channel_type in ('text','announcement','voice','forum'));
alter table public.channels drop constraint if exists channels_slowmode_seconds_check;
alter table public.channels add constraint channels_slowmode_seconds_check check (slowmode_seconds between 0 and 21600);
create index if not exists channels_category_order_idx on public.channels(workspace_id, category_id, position, created_at);

create table if not exists public.channel_permission_overwrites (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  target_type text not null check (target_type in ('everyone','role','member')),
  target_id uuid,
  allow_permissions jsonb not null default '{}'::jsonb,
  deny_permissions jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint channel_overwrite_target_shape check ((target_type='everyone' and target_id is null) or (target_type in ('role','member') and target_id is not null)),
  constraint channel_overwrite_permissions_object check (jsonb_typeof(allow_permissions)='object' and jsonb_typeof(deny_permissions)='object')
);
create unique index if not exists channel_overwrite_everyone_unique on public.channel_permission_overwrites(channel_id) where target_type='everyone';
create unique index if not exists channel_overwrite_target_unique on public.channel_permission_overwrites(channel_id,target_type,target_id) where target_id is not null;
create index if not exists channel_overwrite_channel_idx on public.channel_permission_overwrites(channel_id);
alter table public.channel_permission_overwrites enable row level security;
grant select, insert, update, delete on public.channel_permission_overwrites to authenticated;
drop policy if exists channel_overwrites_select_member on public.channel_permission_overwrites;
create policy channel_overwrites_select_member on public.channel_permission_overwrites for select to authenticated using (exists(select 1 from public.channels c where c.id=channel_id and private.is_workspace_member(c.workspace_id)));
drop policy if exists channel_overwrites_manage on public.channel_permission_overwrites;
create policy channel_overwrites_manage on public.channel_permission_overwrites for all to authenticated using (exists(select 1 from public.channels c where c.id=channel_id and private.has_workspace_permission(c.workspace_id,'manage_channels'))) with check (created_by=(select auth.uid()) and exists(select 1 from public.channels c where c.id=channel_id and private.has_workspace_permission(c.workspace_id,'manage_channels')));

create or replace function private.has_channel_permission(p_channel_id uuid,p_permission text)
returns boolean language sql stable security definer set search_path=''
as $$
with target as (select c.workspace_id,c.is_private from public.channels c where c.id=p_channel_id),
membership as (select t.workspace_id,t.is_private,private.is_workspace_member(t.workspace_id) as is_member,private.is_workspace_admin(t.workspace_id) as is_admin from target t),
roles as (select r.id from public.workspace_member_roles mr join public.workspace_roles r on r.id=mr.role_id and r.workspace_id=mr.workspace_id join membership m on m.workspace_id=mr.workspace_id where mr.user_id=(select auth.uid())),
overwrites as (select o.* from public.channel_permission_overwrites o where o.channel_id=p_channel_id),
member_rule as (select coalesce(bool_or(o.allow_permissions->>p_permission='true'),false) as allowed,coalesce(bool_or(o.deny_permissions->>p_permission='true'),false) as denied from overwrites o where o.target_type='member' and o.target_id=(select auth.uid())),
role_rule as (select coalesce(bool_or(o.allow_permissions->>p_permission='true'),false) as allowed,coalesce(bool_or(o.deny_permissions->>p_permission='true'),false) as denied from overwrites o where (o.target_type='role' and o.target_id in (select id from roles)) or o.target_type='everyone'),
base_rule as (select coalesce(bool_or(coalesce((r.permissions->>p_permission)::boolean,false)),false) as allowed from public.workspace_member_roles mr join public.workspace_roles r on r.id=mr.role_id and r.workspace_id=mr.workspace_id join membership m on m.workspace_id=mr.workspace_id where mr.user_id=(select auth.uid()))
select coalesce((select case
 when not m.is_member then false
 when m.is_admin then true
 when (select denied from member_rule) then false
 when (select allowed from member_rule) then true
 when (select denied from role_rule) then false
 when (select allowed from role_rule) then true
 when p_permission='view_channel' then not m.is_private
 when p_permission in ('read_messages','send_messages','attach_files','embed_links','add_reactions') then true
 when p_permission in ('connect','speak') then false
 else (select allowed from base_rule)
end from membership m),false);
$$;

drop policy if exists channels_select_workspace_member on public.channels;
create policy channels_select_workspace_member on public.channels for select to authenticated using (private.has_channel_permission(id,'view_channel'));
drop policy if exists messages_select_workspace_member on public.messages;
create policy messages_select_workspace_member on public.messages for select to authenticated using (private.has_channel_permission(channel_id,'view_channel') and private.has_channel_permission(channel_id,'read_messages'));
drop policy if exists messages_insert_self_workspace_member on public.messages;
create policy messages_insert_self_workspace_member on public.messages for insert to authenticated with check (author_id=(select auth.uid()) and private.has_channel_permission(channel_id,'view_channel') and private.has_channel_permission(channel_id,'send_messages'));
drop policy if exists message_reactions_select_member on public.message_reactions;
create policy message_reactions_select_member on public.message_reactions for select to authenticated using (exists(select 1 from public.messages m where m.id=message_id and private.has_channel_permission(m.channel_id,'view_channel')));
drop policy if exists message_reactions_insert_self_member on public.message_reactions;
create policy message_reactions_insert_self_member on public.message_reactions for insert to authenticated with check (user_id=(select auth.uid()) and exists(select 1 from public.messages m where m.id=message_id and private.has_channel_permission(m.channel_id,'view_channel') and private.has_channel_permission(m.channel_id,'add_reactions')));

do $$ begin alter publication supabase_realtime add table public.workspace_categories; exception when duplicate_object then null; when undefined_object then null; end $$;
