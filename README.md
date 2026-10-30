# Pickleball

Учёт игр в пиклбол для компании друзей: кто пришёл, рулетка пар, счёт матчей, статистика по парам и игрокам.

- `frontend/` — React + TypeScript + Vite + Ant Design, PWA
- `backend/` — PHP 8.4, Slim 4, MySQL (локально SQLite)
- `deploy/` — точка входа API для веб-корня
- `.github/workflows/deploy.yml` — тесты и деплой на Namecheap при пуше в `main`

## Локальный запуск

```bash
# backend (порт 8080, база SQLite в backend/var/)
cd backend
composer install
cp config.example.php config.php
mkdir -p var && php bin/migrate.php
php bin/create-superadmin.php --name="Max" --email=you@example.com --password=secret --group="Friends"
composer serve

# frontend (порт 5173, /api проксируется на 8080)
cd frontend
npm install
npm run dev
```

Тесты бэкенда: `cd backend && composer test`.

## Как устроено на хостинге

```
~/pickleball.buldov.com/        ← корень субдомена (собранный фронт + api/index.php)
~/pickleball-backend/           ← код бэкенда, vendor/, config.php (вне публичной папки)
```

## Первый деплой на Namecheap (один раз)

1. **cPanel → Subdomains**: создать `pickleball.buldov.com`, корень — `pickleball.buldov.com` (по умолчанию).
2. **cPanel → Select PHP Version**: PHP 8.4, включить расширения `pdo_mysql`, `mbstring`.
3. **cPanel → MySQL Databases**: создать базу и пользователя, дать пользователю ALL PRIVILEGES на базу.
4. **SSL**: в cPanel → SSL/TLS Status включить AutoSSL для субдомена.
5. **SSH-ключ для деплоя** (на своём компьютере):
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/pickleball_deploy -N ""
   ```
   Публичный ключ (`~/.ssh/pickleball_deploy.pub`) добавить в cPanel → SSH Access → Manage SSH Keys → Import, затем **Authorize**.
6. **Конфиг на сервере** (по SSH, `ssh -p 21098 USER@buldov.com`):
   ```bash
   mkdir -p ~/pickleball-backend
   nano ~/pickleball-backend/config.php
   ```
   Содержимое — как в `backend/config.example.php`, но с MySQL:
   ```php
   <?php
   return [
       'db' => [
           'dsn' => 'mysql:host=localhost;dbname=USER_pickleball;charset=utf8mb4',
           'user' => 'USER_pickleball',
           'password' => '...',
       ],
       'jwt_secret' => '...64 случайных символа...',   // php -r 'echo bin2hex(random_bytes(32));'
       'app_url' => 'https://pickleball.buldov.com',
       'debug' => false,
   ];
   ```
7. **GitHub → Settings → Secrets and variables → Actions**:
   - Secrets: `SSH_HOST` (например `buldov.com` или IP сервера), `SSH_PORT` (`21098`), `SSH_USER` (логин cPanel), `SSH_PRIVATE_KEY` (содержимое `~/.ssh/pickleball_deploy`).
   - Variables (необязательно): `WEB_ROOT` — папка субдомена, если отличается от `pickleball.buldov.com`; `PHP_BIN` — путь к PHP 8.4 CLI, если `php` на сервере другой версии (проверить: `php -v`; на Namecheap обычно `/opt/alt/php84/usr/bin/php`).
8. **Пуш в `main`** — GitHub Actions прогонит тесты, соберёт и зальёт всё, применит миграции.
9. **Создать себя** (один раз, по SSH):
   ```bash
   php ~/pickleball-backend/bin/create-superadmin.php --name="Max" --email=you@example.com --password=... --group="Friends"
   ```

Дальше каждый пуш в `main` деплоит автоматически.

## Правила

- **Счёт**: игра до 11, победа с разницей 2. 11:9 — можно, 11:10 — нельзя; после 11 разница ровно 2 (12:10, 13:11).
- **Рулетка** выбирает разбиение на пары, где партнёры реже всего играли вместе (по всем матчам группы), и старается не повторять предыдущий расклад. При нечётном числе один остаётся без пары.
- **Права**: матчи добавляют все; редактировать и удалять — админ группы (каждая правка пишется в историю, у матча метка `edited`); группы и роли — только супер-админ.
- **Гости** — игроки без аккаунта. Ссылка-приглашение превращает гостя в пользователя с сохранением истории; для активного игрока та же ссылка работает как сброс пароля.
