# Giacong.vn Bagisto Backend

Backend quản trị cho dự án Giacong.vn. Bagisto quản lý sản phẩm, biến thể, ảnh, giá, tồn kho, MOQ, bước số lượng và ngưỡng liên hệ. Storefront Next.js nằm ở thư mục gốc của cùng repository này.

## Chạy local

Cần Docker Desktop đang chạy, PHP 8.3 hoặc 8.4 cùng Composer 2, và Git.

```powershell
Copy-Item .env.example .env
composer install
```

Trong `.env`, đặt:

```dotenv
APP_URL=http://localhost:18001
DB_DATABASE=bagisto
DB_USERNAME=sail
DB_PASSWORD=password
BAGISTO_PORT=18001
```

Khởi động và tạo dữ liệu demo:

```powershell
docker compose up -d
docker compose exec -u sail laravel.test php artisan bagisto:install
docker compose exec -u sail laravel.test php artisan b2b:catalog:seed-demo
```

Sau đó chạy storefront ở thư mục cha và mở `http://localhost:4317/admin`. Tài khoản demo là `admin@example.com` / `admin123`; đổi mật khẩu nếu dùng ngoài môi trường demo. Xem hướng dẫn đầy đủ ở [SETUP.md](../SETUP.md).

## Phạm vi

Đây là demo B2B: không có checkout, thanh toán, tạo order, tài khoản khách hoặc giao diện quản trị Next.js. Bagisto Admin là giao diện quản trị duy nhất.
