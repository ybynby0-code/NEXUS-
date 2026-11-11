drop policy if exists workspace_categories_manage on public.workspace_categories;
drop policy if exists workspace_categories_insert_manage on public.workspace_categories;
drop policy if exists workspace_categories_update_manage on public.workspace_categories;
drop policy if exists workspace_categories_delete_manage on public.workspace_categories;
create policy workspace_categories_insert_manage on public.workspace_categories for insert to authenticated
with check (private.has_workspace_permission(workspace_id,'manage_channels') and created_by=(select auth.uid()));
create policy workspace_categories_update_manage on public.workspace_categories for update to authenticated
using (private.has_workspace_permission(workspace_id,'manage_channels'))
with check (private.has_workspace_permission(workspace_id,'manage_channels'));
create policy workspace_categories_delete_manage on public.workspace_categories for delete to authenticated
using (private.has_workspace_permission(workspace_id,'manage_channels'));

drop policy if exists channel_overwrites_manage on public.channel_permission_overwrites;
drop policy if exists channel_overwrites_insert_manage on public.channel_permission_overwrites;
drop policy if exists channel_overwrites_update_manage on public.channel_permission_overwrites;
drop policy if exists channel_overwrites_delete_manage on public.channel_permission_overwrites;
create policy channel_overwrites_insert_manage on public.channel_permission_overwrites for insert to authenticated
with check (created_by=(select auth.uid()) and exists(select 1 from public.channels c where c.id=channel_id and private.has_workspace_permission(c.workspace_id,'manage_channels')));
create policy channel_overwrites_update_manage on public.channel_permission_overwrites for update to authenticated
using (exists(select 1 from public.channels c where c.id=channel_id and private.has_workspace_permission(c.workspace_id,'manage_channels')))
with check (exists(select 1 from public.channels c where c.id=channel_id and private.has_workspace_permission(c.workspace_id,'manage_channels')));
create policy channel_overwrites_delete_manage on public.channel_permission_overwrites for delete to authenticated
using (exists(select 1 from public.channels c where c.id=channel_id and private.has_workspace_permission(c.workspace_id,'manage_channels')));
