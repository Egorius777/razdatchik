# Раздатчик — учёт «раздатчик ↔ репетиторы»

Telegram Mini App для учёта уроков, входящих оплат и недельных выплат. **Не проводит платежи** — только ledger.

## Стек

- Next.js 15 (App Router) + TypeScript + Tailwind
- Prisma + PostgreSQL (Railway)
- grammY (Telegram bot webhook)
- Railway Volume для чеков (`/data/receipts`)

## Локальная разработка

1. Скопируйте `.env.example` → `.env` и задайте переменные.
2. Поднимите PostgreSQL и укажите `DATABASE_URL`.
3. Установите зависимости и примените миграции:

```bash
npm install
npm run migrate:dev
npm run seed
npm run dev
```

В dev-режиме можно войти с `initData: "dev"` (автоматически в браузере без Telegram).

## Переменные окружения

| Переменная | Описание |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Railway Postgres) |
| `BOT_TOKEN` | Токен бота от BotFather |
| `JWT_SECRET` | Секрет для app-JWT (длинная случайная строка) |
| `CRON_SECRET` | Заголовок `x-cron-secret` для cron-эндпоинта |
| `PUBLIC_APP_URL` | Публичный URL приложения на Railway |
| `RECEIPTS_DIR` | Путь к чекам, на Railway: `/data/receipts` |

## Деплой на Railway

### 1. BotFather

1. Создайте бота → получите `BOT_TOKEN`.
2. В BotFather задайте **Menu Button** / Mini App URL на домен Railway.
3. Укажите домен в `PUBLIC_APP_URL`.

### 2. Railway

1. Новый проект → **Add PostgreSQL**.
2. Deploy из репозитория (Nixpacks подхватит `railway.json`).
3. **Add Volume**, смонтируйте в `/data`.
4. Задайте env-переменные из таблицы выше.
5. Получите публичный домен → обновите `PUBLIC_APP_URL` и Mini App URL в BotFather.

Миграции применяются при старте: `npm run migrate && npm start`.

### 3. Webhook бота

Один раз после деплоя:

```bash
npm run set-webhook
```

Или через Railway Shell с теми же env.

### 4. Cron (недельная сводка)

В Railway Cron создайте задачу, например **Пн 09:00 UTC**:

```
POST https://<your-domain>/api/cron/weekly-settlement
Header: x-cron-secret: <CRON_SECRET>
```

## Скрипты

| Команда | Назначение |
|---|---|
| `npm run dev` | Локальный сервер |
| `npm run build` | Prisma generate + Next.js build |
| `npm run migrate` | `prisma migrate deploy` |
| `npm run seed` | Демо-данные + самопроверка |
| `npm run test` | Unit-тесты расчёта |
| `npm run typecheck` | TypeScript |
| `npm run set-webhook` | Установить webhook бота |

## Контрольный пример

Ученик **2000 ₽**, комиссия **25%**, **3 урока** за неделю:

- раздатчику: **1500 ₽** комиссии
- репетитору: **4500 ₽** net

Проверяется в `npm run test` и `npm run seed`.

## Роли

- **Раздатчик** — подтверждает оплаты, видит входящие и выплаты, приглашает репетиторов.
- **Репетитор** — ведёт своих учеников, отмечает уроки и оплаты с чеками.

Доступ закрытый: репетиторы только по коду приглашения (`/start CODE` или ввод в Mini App).
