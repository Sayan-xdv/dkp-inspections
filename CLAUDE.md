@AGENTS.md

## Текущее состояние (2026-07-05, после большой пересборки)

**Прод-домен:** https://dkp-inspections.vercel.app · Архитектура и развёртывание — в README.md.

**Демо-юзеры (пароль у всех `Demo2026!`):**

| Роль | Логин | Куда попадает |
|---|---|---|
| Admin | `admin@dkp.samolet.ru` | `/dashboard/overview` (аналитика) |
| Settlement (ключник) | `keys@dkp.samolet.ru` | `/dashboard/settlement` |
| Contractor Аксиома | `aksioma@dkp.samolet.ru` | `/dashboard/contractor` |
| Contractor Войс | `voice@dkp.samolet.ru` | `/dashboard/contractor` |
| Contractor РБО | `rbo@dkp.samolet.ru` | `/dashboard/contractor` |
| Contractor Мещеряков | `meshcheryakov@dkp.samolet.ru` | `/dashboard/contractor` |

Под админом доступны все разделы — sales и crm_loader отдельных юзеров нет.

**Демо-данные:** 300 квартир по всем 8 статусам (Аксиома 60/Войс 40/РБО 60/Мещеряков 80), история переходов, уведомления. Даты в сиде — относительно CURRENT_DATE. У квартир СМ-2026-00220/00221/00242 реальные PDF в Storage — полный цикл contractor→crm-loader показуем.

**Ключевые факты (2026-07-05):**
1. **Supabase wipe решён**: `supabase/seed.sql` — идемпотентный полный пересев (5 минут: restore → 001 → 004 → seed). Vercel Cron `0 6 * * *` → `/api/health` держит базу активной.
2. **RLS-фикс в миграции**: `001_create_schema.sql` идемпотентна, политики сразу на SECURITY DEFINER функциях.
3. **Storage не принимает кириллические ключи** — пути PDF только через `sanitizeStorageKey()` (`src/lib/utils.ts`).
4. **Дизайн-система едина на всех 12 страницах** — новые блоки собирать из `components/layout/page-header`, `components/dashboard/kpi-card`, `components/shared/*`, `components/apartments/*`.
5. **Переходы статусов** — только с guard'ом `.in('status', allowedSourceStatuses(to, role))` из `lib/workflow/state-machine.ts`.
6. **Vercel auto-deploy**: push в `main` → прод.

**Скрипты:**
- `screenshots-demo/verify_all.py` — Playwright-прогон логинов всех ролей + скриншоты всех страниц (в `v2/`).
- `screenshots-demo/take_all.py` — старый скрипт съёмки (desktop+mobile).



<!-- VERCEL BEST PRACTICES START -->
## Best practices for developing on Vercel

These defaults are optimized for AI coding agents (and humans) working on apps that deploy to Vercel.

- Treat Vercel Functions as stateless + ephemeral (no durable RAM/FS, no background daemons), use Blob or marketplace integrations for preserving state
- Edge Functions (standalone) are deprecated; prefer Vercel Functions
- Don't start new projects on Vercel KV/Postgres (both discontinued); use Marketplace Redis/Postgres instead
- Store secrets in Vercel Env Variables; not in git or `NEXT_PUBLIC_*`
- Provision Marketplace native integrations with `vercel integration add` (CI/agent-friendly)
- Sync env + project settings with `vercel env pull` / `vercel pull` when you need local/offline parity
- Use `waitUntil` for post-response work; avoid the deprecated Function `context` parameter
- Set Function regions near your primary data source; avoid cross-region DB/service roundtrips
- Tune Fluid Compute knobs (e.g., `maxDuration`, memory/CPU) for long I/O-heavy calls (LLMs, APIs)
- Use Runtime Cache for fast **regional** caching + tag invalidation (don't treat it as global KV)
- Use Cron Jobs for schedules; cron runs in UTC and triggers your production URL via HTTP GET
- Use Vercel Blob for uploads/media; Use Edge Config for small, globally-read config
- If Enable Deployment Protection is enabled, use a bypass secret to directly access them
- Add OpenTelemetry via `@vercel/otel` on Node; don't expect OTEL support on the Edge runtime
- Enable Web Analytics + Speed Insights early
- Use AI Gateway for model routing, set AI_GATEWAY_API_KEY, using a model string (e.g. 'anthropic/claude-sonnet-4.6'), Gateway is already default in AI SDK
  needed. Always curl https://ai-gateway.vercel.sh/v1/models first; never trust model IDs from memory
- For durable agent loops or untrusted code: use Workflow (pause/resume/state) + Sandbox; use Vercel MCP for secure infra access
<!-- VERCEL BEST PRACTICES END -->
