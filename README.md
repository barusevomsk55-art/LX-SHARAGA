# LX ШАРАГА

Персональный сайт школьного расписания с адаптивным интерфейсом и поддержкой PWA.

## Полный проект

Полный исходный комплект Cloudflare Worker + D1 подготовлен отдельно. Он включает `public/` (сайт и PWA), `src/index.js` (API, Telegram webhook, Cron и ICS), миграцию D1, `wrangler.toml`, GitHub Actions и подробный README.

**Важно:** исходники ещё не загружены в этот репозиторий; этот README фиксирует проект и инструкции. Не запускайте публикацию, пока файлы проекта не добавлены.

## Что потребуется для публикации

1. Cloudflare аккаунт.
2. Node.js LTS.
3. Создать D1 базу `lx-sharaga-db` и вписать выданный `database_id` в `wrangler.toml`.
4. Применить миграцию `npx wrangler d1 migrations apply lx-sharaga-db --remote`.
5. Задать секреты Telegram через `npx wrangler secret put`.
6. Выполнить `npm install` и `npm run deploy`.

Никогда не помещайте Telegram Bot Token в HTML, JavaScript или GitHub.