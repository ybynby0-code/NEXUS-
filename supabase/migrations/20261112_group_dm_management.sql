-- Group DM membership and title management
create or replace function public.manage_group_dm_member(
  p_conversation_id uuid,
  p_target_user_id uuid,
  p_action text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_is_group boolean;
  v_owner uuid;
  v_actor_role text;
  v_target_role text;
  v_count integer;
  v_next_owner uuid;
begin
  if v_user is null then raise exception '로그인이 필요합니다.'; end if;
  if p_action not in ('invite','remove','leave') then raise exception '지원하지 않는 작업입니다.'; end if;

  select c.is_group,c.owner_id into v_is_group,v_owner
  from public.dm_conversations c where c.id=p_conversation_id for update;
  if not found or not v_is_group then raise exception '그룹 DM을 찾을 수 없습니다.'; end if;

  select m.role into v_actor_role
  from public.dm_conversation_members m
  where m.conversation_id=p_conversation_id and m.user_id=v_user;
  if v_actor_role is null then raise exception '이 대화의 참여자가 아닙니다.'; end if;

  if p_action='invite' then
    if p_target_user_id is null or p_target_user_id=v_user then raise exception '초대할 사용자를 선택해 주세요.'; end if;
    if not exists (
      select 1 from public.friend_requests f
      where f.status='accepted'
        and ((f.sender_id=v_user and f.recipient_id=p_target_user_id)
          or (f.sender_id=p_target_user_id and f.recipient_id=v_user))
    ) then raise exception '친구로 등록된 사용자만 초대할 수 있습니다.'; end if;
    if exists(select 1 from public.dm_conversation_members m where m.conversation_id=p_conversation_id and m.user_id=p_target_user_id) then
      raise exception '이미 그룹 DM에 참여 중입니다.';
    end if;
    select count(*) into v_count from public.dm_conversation_members m where m.conversation_id=p_conversation_id;
    if v_count>=10 then raise exception '그룹 DM은 최대 10명까지 참여할 수 있습니다.'; end if;
    insert into public.dm_conversation_members(conversation_id,user_id,role)
    values(p_conversation_id,p_target_user_id,'member');
    return true;
  end if;

  if p_action='remove' then
    if p_target_user_id is null or p_target_user_id=v_user then raise exception '본인을 제거하려면 나가기를 사용하세요.'; end if;
    if v_owner<>v_user and v_actor_role<>'owner' then raise exception '그룹 소유자만 다른 멤버를 내보낼 수 있습니다.'; end if;
    select m.role into v_target_role from public.dm_conversation_members m
    where m.conversation_id=p_conversation_id and m.user_id=p_target_user_id;
    if v_target_role is null then raise exception '해당 멤버가 그룹에 없습니다.'; end if;
    if v_target_role='owner' or p_target_user_id=v_owner then raise exception '소유자는 다른 멤버가 내보낼 수 없습니다.'; end if;
    delete from public.dm_conversation_members where conversation_id=p_conversation_id and user_id=p_target_user_id;
    return true;
  end if;

  -- leave: callers can only remove their own membership.
  if p_target_user_id is not null and p_target_user_id<>v_user then raise exception '본인만 그룹 DM에서 나갈 수 있습니다.'; end if;
  if v_owner=v_user or v_actor_role='owner' then
    select m.user_id into v_next_owner
    from public.dm_conversation_members m
    where m.conversation_id=p_conversation_id and m.user_id<>v_user
    order by m.joined_at asc limit 1;
    if v_next_owner is null then
      delete from public.dm_conversations where id=p_conversation_id;
      return true;
    end if;
    update public.dm_conversation_members set role='member'
    where conversation_id=p_conversation_id and role='owner';
    update public.dm_conversation_members set role='owner'
    where conversation_id=p_conversation_id and user_id=v_next_owner;
    update public.dm_conversations set owner_id=v_next_owner where id=p_conversation_id;
  end if;
  delete from public.dm_conversation_members where conversation_id=p_conversation_id and user_id=v_user;
  return true;
end;
$$;

create or replace function public.rename_group_dm(
  p_conversation_id uuid,
  p_name text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_is_group boolean;
  v_role text;
  v_name text := nullif(btrim(coalesce(p_name,'')),'');
begin
  if v_user is null then raise exception '로그인이 필요합니다.'; end if;
  if v_name is null then raise exception '그룹 이름을 입력해 주세요.'; end if;
  if char_length(v_name)>80 then raise exception '그룹 이름은 80자 이하여야 합니다.'; end if;
  select c.is_group,c.owner_id into v_is_group,v_owner
  from public.dm_conversations c where c.id=p_conversation_id;
  if not found or not v_is_group then raise exception '그룹 DM을 찾을 수 없습니다.'; end if;
  select m.role into v_role from public.dm_conversation_members m
  where m.conversation_id=p_conversation_id and m.user_id=v_user;
  if v_role is null then raise exception '이 대화의 참여자가 아닙니다.'; end if;
  if v_owner<>v_user and v_role<>'owner' then raise exception '그룹 소유자만 이름을 변경할 수 있습니다.'; end if;
  update public.dm_conversations set name=v_name where id=p_conversation_id;
  return true;
end;
$$;

revoke all on function public.manage_group_dm_member(uuid,uuid,text) from public;
revoke all on function public.rename_group_dm(uuid,text) from public;
grant execute on function public.manage_group_dm_member(uuid,uuid,text) to authenticated;
grant execute on function public.rename_group_dm(uuid,text) to authenticated;
