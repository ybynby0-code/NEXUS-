# NEXUS

NEXUS is a mobile-first collaboration workspace.

## Current state
- Vite + React + TypeScript frontend
- Interactive local UI prototype
- Supabase client scaffold added
- Initial database schema with row-level security in `supabase/schema.sql`

## Supabase setup
1. Activate and select the Supabase project intended for NEXUS.
2. Review and apply `supabase/schema.sql` in that project's SQL Editor.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the deployment environment.
4. Never put a Supabase secret/service-role key in browser code.

Authentication and live database operations are not yet wired into the UI. The schema must be reviewed and applied to the selected project before connecting the app.
