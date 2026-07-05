# Экспертизы ДКП

Веб-платформа управления экспертизами качества отделки квартир перед передачей по ДКП.
Заменяет Excel-процесс: от выгрузки CRM до загрузки готового отчёта обратно в CRM.

**Демо:** https://dkp-inspections.vercel.app

---

## Архитектура

| Слой | Технология |
|---|---|
| Frontend + API | Next.js 16 (App Router, TypeScript), Tailwind CSS v4, shadcn/ui, recharts |
| База данных | PostgreSQL 17 (Supabase) |
| Аутентификация | Supabase Auth (email + пароль, JWT в cookie) |
| Файлы (PDF-отчёты) | Supabase Storage, bucket `inspection-reports` |
| Хостинг | Vercel (авто-деплой из `main`) |

### Роли и разделы

| Роль | Раздел | Функции |
|---|---|---|
| `sales` | `/dashboard/sales` | Импорт Excel из CRM, реестр квартир, KPI |
| `settlement` | `/dashboard/settlement` | Очередь ключей: подтверждение доступа / причины отказа |
| `contractor` | `/dashboard/contractor` | Задания своей компании, загрузка PDF-отчётов |
| `crm_loader` | `/dashboard/crm-loader` | Скачивание готовых отчётов (PDF/ZIP), отметка загрузки в CRM |
| `admin` | `/dashboard/overview` + всё | Аналитика, рассылка подрядчикам, справочники, пользователи |

### Workflow квартиры

```
pending_keys ──(ОЗ: ключи есть)──▶ keys_available ──(DB-триггер)──▶ assigned
     ▲                                                                  │
     │                                              ┌───────────────────┤
     └──(ОЗ вернул)── keys_unavailable              ▼                   ▼
     ▲                                        in_progress ──▶ completed ──▶ uploaded_to_crm
     └────────────── rejected ◀──(подрядчик: нет доступа)──┘
```

- Авто-назначение подрядчика: DB-триггер `fn_auto_assign_contractor` по имени проекта (`projects.contractor_id`).
- Аудит переходов: триггер `fn_track_status_change` пишет в `status_history`.
- Спецификация переходов и optimistic-guard'ы: `src/lib/workflow/state-machine.ts`
  (используется в UPDATE-запросах через `allowedSourceStatuses`).

### Схема БД (8 таблиц)

`contractors` → `projects` (проект принадлежит подрядчику) · `profiles` (расширение auth.users, роль + привязка к подрядчику) · `apartments` (центральная сущность, 30+ полей из CRM) · `status_history` · `rejection_reasons` · `import_batches` · `notifications`.

Полная схема с RLS-политиками: `supabase/migrations/001_create_schema.sql`.

> **RLS:** политики построены на `SECURITY DEFINER` функциях (`current_user_is_admin()`,
> `current_user_has_role()`, `current_user_contractor_id()`). Не заменяйте их на
> `EXISTS (SELECT … FROM profiles)` внутри политик — это даёт infinite recursion (42P17).

---

## Развёртывание с нуля (≈10 минут)

1. **Создать проект Supabase** (или свой Postgres + GoTrue + Storage).
2. **Прогнать миграции** по порядку в SQL-редакторе:
   `supabase/migrations/001_create_schema.sql` → `002_seed_data.sql` → `003_notifications.sql` → `004_storage.sql`.
   Все идемпотентны — повторный прогон безопасен.
3. **Демо-данные** (опционально): `supabase/seed.sql` — создаёт 6 демо-пользователей
   (пароль `Demo2026!`), 300 квартир во всех статусах с датами относительно текущего дня,
   историю переходов и уведомления. **Пересеиваемый**: таблицы данных очищаются, справочники
   и пользователи — нет.
4. **Env-переменные** (`.env.local` локально / Vercel env в проде):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   SUPABASE_SERVICE_ROLE_KEY=<service role key>   # только сервер: /api/admin/users, /api/import
   ```
5. `npm install && npm run dev` — http://localhost:3000

### Полезное

- **Keepalive**: `vercel.json` содержит cron `0 6 * * *` → `/api/health` — не даёт
  Supabase free-tier уйти в паузу (пауза стирает таблицы!). На платном тарифе не нужен.
- **Восстановление после паузы Supabase**: restore проекта → прогнать `001` → `004` → `seed.sql`. 5 минут.
- **Ключи Storage**: не принимают кириллицу — пути к PDF строятся через
  `sanitizeStorageKey()` (`src/lib/utils.ts`, транслитерация).

---

## Структура кода

```
src/
├── app/
│   ├── login/                  # вход
│   ├── dashboard/
│   │   ├── overview/           # аналитика админа (KPI, воронка, графики, рассылка)
│   │   ├── sales/              # + upload/ (Excel-импорт), registry/ (реестр)
│   │   ├── settlement/         # очередь ключей
│   │   ├── contractor/         # задания подрядчика + загрузка PDF
│   │   ├── crm-loader/         # готовые экспертизы
│   │   ├── loading.tsx         # skeleton всего сегмента
│   │   └── error.tsx           # error boundary
│   ├── admin/                  # users / projects / rejection-reasons
│   ├── api/
│   │   ├── import/             # bulk-вставка квартир из Excel (service role)
│   │   ├── notifications/send/ # запись рассылки (имитация письма)
│   │   ├── admin/users/        # создание пользователей (service role)
│   │   └── health/             # keepalive-пинг для cron
│   └── proxy.ts                # Supabase session refresh + auth-redirect (Next 16)
├── components/
│   ├── ui/                     # shadcn/ui (только используемые)
│   ├── layout/                 # DashboardShell, Sidebar, PageHeader
│   ├── dashboard/              # KpiCard, графики recharts, диалог рассылки
│   ├── apartments/             # StatusBadge, RejectDialog, CrmSearch
│   └── shared/                 # EmptyState, SkeletonTable, ConfirmDialog
└── lib/
    ├── supabase/               # client / server / admin(service-role) / middleware
    ├── excel/                  # парсер выгрузки CRM, маппинг колонок, экспорт
    ├── workflow/               # state-machine, overdue (SLA), waiting
    └── types/database.ts       # типы, STATUS_CONFIG, ROLE_CONFIG
```

Дизайн-токены (шрифты Inter Tight / JetBrains Mono, палитра графиков, анимации) — в
`src/app/globals.css`, применяются через шаренные компоненты.

---

## Известные ограничения MVP

- Переходы статусов защищены optimistic-guard'ами в запросах + RLS; отдельной серверной
  валидации переходов нет (для продакшена — вынести смену статусов в API-route или RPC).
- Sparkline'ы «в работе» и «просрочка» на дашборде — аппроксимация (понедельная история
  не хранится); дельты KPI считаются из реальных данных.
- Рассылка подрядчикам пишет запись в `notifications`, письма не отправляет
  (для продакшена — подключить SMTP/API в `/api/notifications/send`).
- Excel-импорт выполняется на клиенте (SheetJS) + bulk-insert через API.

---

## Продакшен-миграция на Яндекс Облако

Для промышленной эксплуатации в контуре РФ (152-ФЗ, данные в России) рекомендуемая схема:

| Компонент MVP | Продакшен-аналог в Яндекс Облаке |
|---|---|
| Supabase PostgreSQL | **Managed Service for PostgreSQL** — миграции `supabase/migrations/*` совместимы (чистый SQL), схему auth.users заменить своей таблицей пользователей |
| Supabase Auth | Свой IdP: **Keycloak на Compute/K8s** или корпоративный SSO (AD FS / Яндекс ID для организаций). В коде заменить `@supabase/ssr` на выбранный OIDC-клиент — точки входа: `src/lib/supabase/*`, `src/proxy.ts` |
| Supabase Storage | **Object Storage** (S3-совместимый) — заменить `supabase.storage` на S3 SDK, пути и `sanitizeStorageKey` переиспользуются |
| Vercel | **Serverless Containers** или ВМ с Node 20+ (`next build && next start`), фронт за **Application Load Balancer** |
| Vercel Cron | **Cloud Functions + Timer-триггер** (keepalive не нужен на managed-базе) |

Оценка трудоёмкости миграции: 2–3 недели силами одного fullstack-разработчика.
Основной объём — замена Auth (интеграция OIDC + перенос RLS-политик в middleware/API-слой,
т.к. `auth.uid()` — специфика Supabase).

---

## Демо-доступы

Пароль у всех: `Demo2026!`

| Роль | Логин |
|---|---|
| Администратор | `admin@dkp.samolet.ru` |
| Офис заселения | `keys@dkp.samolet.ru` |
| Подрядчик (Аксиома / Войс / РБО / Мещеряков) | `aksioma@` / `voice@` / `rbo@` / `meshcheryakov@dkp.samolet.ru` |
