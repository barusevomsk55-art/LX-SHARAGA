# LX ШАРАГА — Cloudflare backend

This folder contains the Worker API and D1 schema for Telegram notifications and cross-device sync.

## Cloudflare setup

1. Create a D1 database named `lx-sharaga`.
2. Run `schema.sql` against that database.
3. Put the returned database ID into `wrangler.toml`.
4. Set secrets in Cloudflare Worker settings:
   - `TELEGRAM_BOT_TOKEN` — a fresh token from BotFather (never commit it).
   - `TELEGRAM_WEBHOOK_SECRET` — a random long secret.
5. Set `TELEGRAM_BOT_USERNAME` in `wrangler.toml` (without @).
6. Deploy the Worker and set the Telegram webhook to `https://YOUR-WORKER.workers.dev/telegram/webhook`, using the secret token header.
7. Set the Worker URL in the website frontend as `API_BASE`.

## API

- `POST /api/sync/create` — create a workspace and first device token.
- `POST /api/sync/pair/start` — create a 10-minute one-time pairing code.
- `POST /api/sync/pair/claim` — exchange a pairing code for a second-device token.
- `GET /api/sync/state` and `PUT /api/sync/state` — read/write schedule and settings.
- `POST /api/telegram/link` — create a Telegram linking code.
- `POST /api/telegram/unlink` — disconnect Telegram.
- `POST /telegram/webhook` — Telegram bot webhook.
- Cron runs every minute and checks notification times using each user's saved timezone.

All access tokens are stored hashed in D1. Bot tokens belong only in Cloudflare secrets.
