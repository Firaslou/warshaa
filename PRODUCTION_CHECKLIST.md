# Warsha production checklist

The production frontend and all Supabase functions must use the same Supabase
project: `yqhanrhpigzvobwvmuoh`.

## 1. Cloudflare build variables

Configure these in the Cloudflare Worker build settings. Use the publishable
key from Supabase **Settings > API Keys**; never use a secret/service-role key
in a `VITE_` variable.

```text
VITE_SUPABASE_PROJECT_ID=yqhanrhpigzvobwvmuoh
VITE_SUPABASE_URL=https://yqhanrhpigzvobwvmuoh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<owned-project-publishable-key>
```

After Cloudflare has these variables, remove the tracked `.env` file in a
separate commit. `.gitignore` now prevents new local `.env` files from being
committed.

## 2. Database migrations

Run migrations before deploying Edge Functions because the AI functions use
the database-backed rate limiter.

```powershell
& "C:\Program Files\nodejs\npx.cmd" --yes supabase@latest link --project-ref yqhanrhpigzvobwvmuoh
& "C:\Program Files\nodejs\npx.cmd" --yes supabase@latest db push
```

## 3. Supabase secrets

Set these in **Edge Functions > Secrets**:

```text
GEMINI_API_KEY
RESEND_API_KEY
CRON_SECRET
PUBLIC_SITE_URL=https://warshaa.firasloukil2016.workers.dev
```

Supabase automatically supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY`. Do not commit their secret variants.

## 4. Deploy functions

Deploy the functions used by the current application:

```powershell
$projectRef = "yqhanrhpigzvobwvmuoh"
$functions = @(
  "ai-assistant-free",
  "ai-assistant",
  "generate-description",
  "smart-search",
  "image-search",
  "send-transactional-email",
  "approve-creator-application",
  "notify-stock-reminder",
  "mcp"
)
foreach ($functionName in $functions) {
  & "C:\Program Files\nodejs\npx.cmd" --yes supabase@latest functions deploy $functionName --project-ref $projectRef
}
```

## 5. Authentication URLs

In Supabase **Authentication > URL Configuration** set:

```text
Site URL: https://warshaa.firasloukil2016.workers.dev
Redirect URL: https://warshaa.firasloukil2016.workers.dev/**
```

Keep the Google OAuth callback exactly as shown by Supabase:

```text
https://yqhanrhpigzvobwvmuoh.supabase.co/auth/v1/callback
```

## 6. Smoke test after deployment

Test sign-up and Google sign-in, creator and product pages, favorites,
support/follow actions, private chat and typing indicators, notifications,
creator application approval, email delivery, and every AI feature. Confirm an
anonymous browser cannot open `/admin` or invoke protected Edge Functions.
