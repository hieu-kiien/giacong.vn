# Cài đặt local

## Yêu cầu

- Docker Desktop đang chạy.
- Node.js 24 trở lên.

## 1. Khởi động Bagisto

Mở PowerShell trong thư mục `giacong.vn\\bagisto`:

```powershell
Copy-Item .env.example .env
```

Mở `.env` và đặt tối thiểu các giá trị sau:

```dotenv
APP_URL=http://localhost:18001
APP_DEBUG=false
BOOST_ENABLED=false
DEBUGBAR_ENABLED=false
DB_DATABASE=bagisto
DB_USERNAME=sail
DB_PASSWORD=password
BAGISTO_PORT=18001
CACHE_STORE=redis
```

Khởi động và cài dữ liệu demo:

```powershell
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.demo.yml run --rm php composer install
docker compose -f docker-compose.yml -f docker-compose.demo.yml run --rm -u www-data php php artisan bagisto:install --no-interaction
docker compose -f docker-compose.yml -f docker-compose.demo.yml run --rm -u www-data php php artisan b2b:catalog:seed-demo
```

Sau khi cài xong, mở một lần `http://localhost:18001/admin` để Bagisto tạo bộ đệm ban đầu, rồi đăng nhập bằng `admin@example.com` và `admin123`. Đổi mật khẩu nếu dùng ngoài môi trường demo.

## 2. Khởi động website

Mở PowerShell khác trong thư mục gốc `giacong.vn`:

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
# Trong giacong.vn\\bagisto
docker compose -f docker-compose.yml -f docker-compose.demo.yml down
```

Website Next.js dừng bằng `Ctrl+C` tại cửa sổ đang chạy nó.
