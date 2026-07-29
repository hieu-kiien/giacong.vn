# Cài đặt local

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

Lệnh cài đặt sẽ yêu cầu tạo tài khoản quản trị. Hãy tự đặt email và mật khẩu mới, không dùng thông tin demo làm thông tin thật.

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
