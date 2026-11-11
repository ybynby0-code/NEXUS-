-- NEXUS group direct-message foundation
alter table public.dm_conversations
  add column if not exists is_group boolean not null default false,
  add column if not exists name text,
  add column if not exists owner_id uuid references auth.users(id) on delete set null;
create table if not exists public.dm_conversation_members (
  conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key(conversation_id,user_id)
);
create index if not exists dm_conversation_members_user_idx on public.dm_conversation_members(user_id,joined_at desc);
alter table public.dm_conversation_members enable row level security;
grant select, update, delete on public.dm_conversation_members to authenticated;
create or replace function private.is_dm_member(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(select 1 from public.dm_conversation_members m where m.conversation_id=p_conversation_id and m.user_id=(select auth.uid()));
$$;
insert into public.dm_conversation_members(conversation_id,user_id,role)
select c.id,member_id,case when member_id=c.member_one then 'owner' else 'member' end
from public.dm_conversations c
cross join lateral unnest(array[c.member_one,c.member_two]) as member_id
on conflict(conversation_id,user_id) do nothing;

drop policy if exists dm_conversation_members_select_member on public.dm_conversation_members;
create policy dm_conversation_members_select_member on public.dm_conversation_members for select to authenticated
using (private.is_dm_member(conversation_id));
drop policy if exists dm_conversation_members_update_self on public.dm_conversation_members;
create policy dm_conversation_members_update_self on public.dm_conversation_members for update to authenticated
using (user_id=(select auth.uid()) and private.is_dm_member(conversation_id))
with check (user_id=(select auth.uid()) and private.is_dm_member(conversation_id));

create or replace function public.sync_direct_dm_members()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if not coalesce(new.is_group,false) then
    insert into public.dm_conversation_members(conversation_id,user_id,role)
    values(new.id,new.member_one,'owner'),(new.id,new.member_two,'member')
    on conflict(conversation_id,user_id) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists dm_conversations_sync_members on public.dm_conversations;
create trigger dm_conversations_sync_members after insert on public.dm_conversations
for each row execute function public.sync_direct_dm_members();

drop policy if exists dm_conversations_select_member on public.dm_conversations;
create policy dm_conversations_select_member on public.dm_conversations for select to authenticated
using (private.is_dm_member(id));
drop policy if exists dm_messages_select_member on public.dm_messages;
create policy dm_messages_select_member on public.dm_messages for select to authenticated
using (private.is_dm_member(conversation_id));
drop policy if exists dm_messages_insert_sender on public.dm_messages;
create policy dm_messages_insert_sender on public.dm_messages for insert to authenticated
with check (sender_id=(select auth.uid()) and private.is_dm_member(conversation_id));
drop policy if exists dm_messages_mark_read_recipient on public.dm_messages;
create policy dm_messages_mark_read_recipient on public.dm_messages for update to authenticated
using (sender_id<>(select auth.uid()) and private.is_dm_member(conversation_id))
with check (sender_id<>(select auth.uid()) and read_at is not null and private.is_dm_member(conversation_id));

create or replace function public.create_group_dm(p_member_ids uuid[],p_name text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_members uuid[];
  v_first_peer uuid;
  v_conversation_id uuid;
  v_name text := nullif(btrim(coalesce(p_name,'')),'');
  v_count integer;
begin
  if v_user is null then raise exception '로그인이 필요합니다.'; end if;
  select array_agg(distinct x order by x) into v_members
  from unnest(coalesce(p_member_ids,'{}'::uuid[]) || array[v_user]) x where x is not null;
  v_count := coalesce(array_length(v_members,1),0);
  if v_count < 3 or v_count > 10 then raise exception '그룹 DM은 본인을 포함해 3명부터 10명까지 가능합니다.'; end if;
  if v_name is not null and char_length(v_name)>80 then raise exception '그룹 이름은 80자 이하여야 합니다.'; end if;
  if exists (
    select 1 from unnest(v_members) peer
    where peer<>v_user and not exists (
      select 1 from public.friend_requests f
      where f.status='accepted' and ((f.sender_id=v_user and f.recipient_id=peer) or (f.sender_id=peer and f.recipient_id=v_user))
    )
  ) then raise exception '그룹 DM에는 친구로 등록된 사용자만 초대할 수 있습니다.'; end if;
  select peer into v_first_peer from unnest(v_members) peer where peer<>v_user order by peer limit 1;
  insert into public.dm_conversations(member_one,member_two,is_group,name,owner_id)
  values(least(v_user,v_first_peer),greatest(v_user,v_first_peer),true,v_name,v_user)
  returning id into v_conversation_id;
  insert into public.dm_conversation_members(conversation_id,user_id,role)
  select v_conversation_id,peer,case when peer=v_user then 'owner' else 'member' end from unnest(v_members) peer;
  return v_conversation_id;
end;
$$;
revoke all on function public.create_group_dm(uuid[],text) from public, anon;
grant execute on function public.create_group_dm(uuid[],text) to authenticated;
do $$ begin alter publication supabase_realtime add table public.dm_conversation_members; exception when duplicate_object then null; when undefined_object then null; end $$;
