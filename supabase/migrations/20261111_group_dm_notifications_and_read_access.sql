create policy notifications_insert_group_dm on public.notifications for insert to authenticated
with check (
  actor_id=(select auth.uid()) and recipient_id<>(select auth.uid()) and type='dm'
  and exists(select 1 from public.dm_conversation_members actor_member where actor_member.conversation_id=target_id and actor_member.user_id=(select auth.uid()))
  and exists(select 1 from public.dm_conversation_members recipient_member where recipient_member.conversation_id=target_id and recipient_member.user_id=recipient_id)
);
revoke update on public.dm_conversation_members from authenticated;
grant update(last_read_at) on public.dm_conversation_members to authenticated;
