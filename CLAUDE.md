@AGENTS.md

## Текущее состояние (2026-06-04)

**Прод-домен:** https://dkp-inspections.vercel.app

**Демо-юзеры (пароль у всех `Demo2026!`):**

| Роль | Логин | Куда попадает |
|---|---|---|
| Admin | `admin@dkp.samolet.ru` | `/dashboard/overview` (wow-аналитика) |
| Settlement (ключник) | `keys@dkp.samolet.ru` | `/dashboard/settlement` |
| Contractor Аксиома | `aksioma@dkp.samolet.ru` | `/dashboard/contractor` |
| Contractor Войс | `voice@dkp.samolet.ru` | `/dashboard/contractor` |
| Contractor РБО | `rbo@dkp.samolet.ru` | `/dashboard/contractor` |
| Contractor Мещеряков | `meshcheryakov@dkp.samolet.ru` | `/dashboard/contractor` |

Под админом доступны все разделы — sales и crm_loader отдельных юзеров пока нет.

**Демо-данные:** 300 квартир по всем 8 статусам, 793 записи `status_history`, 8 уведомлений за 7 дней, 3 import-батча. Распределение по подрядчикам: Аксиома 60, Войс 40, РБО 60, Мещеряков 80.

**⚠️ Известные нюансы:**
1. **Supabase free-tier** периодически уходит в `INACTIVE` и **стирает все таблицы**. При следующей такой ситуации — `restore_project` поднимет проект, но данные надо пересеять (см. историю чата 2026-06-04 или скрипты в `supabase/migrations/`). Рассмотреть апгрейд до Pro tier.
2. **RLS-политики** на проде переписаны на SECURITY DEFINER функции (`current_user_is_admin()`, `current_user_has_role()`, `current_user_contractor_id()`) — исходные политики в `001_create_schema.sql` имели infinite recursion. При пересборке схемы фикс надо применять заново или обновить файл миграции.
3. **Vercel-GitHub auto-deploy** работает: push в `main` → автодеплой в production через webhook.

**Скрипты:**
- `screenshots-demo/take_all.py` — авто-скриншоты всех страниц через Playwright (нужен пароль из таблицы выше).



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
