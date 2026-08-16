# Warsha audit report — 2026-08-16

## Scope

The audit covered frontend routing and data access, authentication and role
loading, creator/product pages, chat and Realtime authorization, Supabase RLS
and trigger protections, Edge Function authentication, AI quota protection,
email delivery, deployment configuration, dependency health, and failure
handling.

## Corrected

- Creator pages now load products through the real `startup_id` relationship.
- Authentication waits for roles before exposing admin/creator authorization
  state and ignores stale session requests.
- Private chat typing uses one subscribed private channel and participant-only
  Realtime policies; obsolete native-live signaling permissions are removed.
- External profile and attachment URLs reject executable URL schemes.
- A top-level error boundary replaces blank-screen failures with recovery UI.
- AI functions require authenticated users and enforce database-backed,
  per-user rate limits.
- Creator approval validates every database operation and grants the creator
  role only after the startup exists.
- Transactional email remains service-to-service only, uses sanitized
  idempotency keys, and builds links from `PUBLIC_SITE_URL`.
- Anonymous analytics writes are closed because the application does not use
  them.
- Startup owners can no longer transfer ownership or forge protected status,
  badge, like, or supporter counters.
- Trigger-only SECURITY DEFINER functions remain unavailable through the Data
  API and default public function execution is revoked.
- The stock reminder job now rejects non-POST requests, hides internal errors,
  and is configured for its separate `CRON_SECRET` authentication.
- Obsolete Lovable Cloud Auth and build tagger dependencies were removed.
- Social preview metadata now points to the independently hosted Warsha site.
- The Supabase project configuration and MCP data tools target the owned
  project and current product schema.

## Validation

- `tsc --noEmit`: passed with zero errors.
- `eslint .`: passed with zero errors; 11 development-only Fast Refresh
  organization warnings remain in shared UI/context modules.
- `npm audit --offline`: zero known vulnerabilities across 662 dependencies.
- `npm install --package-lock-only --offline`: passed, confirming npm manifest
  and lockfile consistency.
- `package.json` and the Bun workspace dependency lists are aligned for
  Cloudflare's frozen Bun install.

Vite build and Vitest startup could not run inside this Codex filesystem
sandbox because esbuild is denied while enumerating an ancestor directory.
Cloudflare or a normal local terminal must run the final build and tests after
the production environment variables are configured.

## Deployment dependency

The tracked legacy `.env` still targets the previous Lovable-owned Supabase
project. Do not remove it until the three `VITE_SUPABASE_*` variables in
`PRODUCTION_CHECKLIST.md` are configured in Cloudflare. Then remove the tracked
file and redeploy so the frontend, database, Auth, and Edge Functions all use
`yqhanrhpigzvobwvmuoh`.
