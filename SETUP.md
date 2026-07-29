# Cài đặt local

## Yêu cầu

- Docker Desktop đang chạy.
- PHP 8.3 hoặc 8.4 cùng Composer 2.
- Node.js 24 trở lên.

## 1. Khởi động Bagisto

Mở PowerShell trong thư mục `giacong-bagisto`:

```powershell
Copy-Item .env.example .env
composer install
```

Mở `.env` và đặt tối thiểu các giá trị sau:

```dotenv
APP_URL=http://localhost:18001
DB_DATABASE=bagisto
DB_USERNAME=sail
DB_PASSWORD=password
BAGISTO_PORT=18001
```

Khởi động và cài dữ liệu demo:

```powershell
docker compose up -d
docker compose exec -u sail laravel.test php artisan bagisto:install
docker compose exec -u sail laravel.test php artisan b2b:catalog:seed-demo
```

Sau khi cài xong, đăng nhập quản trị tại `http://localhost:18001/admin` bằng `admin@example.com` và `admin123`. Đổi mật khẩu nếu dùng ngoài môi trường demo.

## 2. Khởi động website

Mở PowerShell khác trong thư mục `giacong.vn`:

```powershell
Copy-Item .env.example .env.local
npm ci
npm run dev -- -p 4317
```

Giữ hai giá trị Bagisto mặc định trong `.env.local`:

```dotenv
BAGISTO_API_URL=http://127.0.0.1:18001
BAGISTO_PROXY_ORIGIN=http://127.0.0.1:18001
```

Nếu cần nhận yêu cầu thật, thêm URL Apps Script vào `GOOGLE_SHEETS_WEBHOOK_URL`. Không cần đặt biến này để xem demo.

## 3. Dừng dịch vụ

```powershell
# Trong giacong-bagisto
docker compose down
```

Website Next.js dừng bằng `Ctrl+C` tại cửa sổ đang chạy nó.
