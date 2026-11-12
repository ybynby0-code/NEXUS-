-- NEXUS channel typing indicator: private Realtime Broadcast access
drop policy if exists "nexus_typing_read_workspace_members" on realtime.messages;
create policy "nexus_typing_read_workspace_members"
on realtime.messages
for select
to authenticated
using (
  extension = 'broadcast'
  and topic like 'nexus-typing-%'
  and exists (
    select 1
    from public.channels c
    join public.workspace_members wm on wm.workspace_id = c.workspace_id
    where c.id::text = replace(realtime.topic(), 'nexus-typing-', '')
      and wm.user_id = (select auth.uid())
  )
);

drop policy if exists "nexus_typing_send_workspace_members" on realtime.messages;
create policy "nexus_typing_send_workspace_members"
on realtime.messages
for insert
to authenticated
with check (
  extension = 'broadcast'
  and topic like 'nexus-typing-%'
  and exists (
    select 1
    from public.channels c
    join public.workspace_members wm on wm.workspace_id = c.workspace_id
    where c.id::text = replace(realtime.topic(), 'nexus-typing-', '')
      and wm.user_id = (select auth.uid())
  )
);
