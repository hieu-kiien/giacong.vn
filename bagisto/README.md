# Giacong.vn Bagisto Backend

Backend quản trị cho dự án Giacong.vn. Bagisto quản lý sản phẩm, biến thể, ảnh, giá, tồn kho, MOQ, bước số lượng và ngưỡng liên hệ. Storefront Next.js nằm ở thư mục gốc của cùng repository này.

## Chạy local

Cần Docker Desktop đang chạy và Node.js 24 trở lên để chạy storefront Next.js. PHP và Composer không cần cài trên máy vì đã nằm trong container.

```powershell
Copy-Item .env.example .env
```

Trong `.env`, đặt:

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

Khởi động và tạo dữ liệu demo:

```powershell
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.demo.yml run --rm php composer install
docker compose -f docker-compose.yml -f docker-compose.demo.yml run --rm -u www-data php php artisan bagisto:install --no-interaction
docker compose -f docker-compose.yml -f docker-compose.demo.yml run --rm -u www-data php php artisan b2b:catalog:seed-demo
```

Mở `http://localhost:18001/admin` một lần để Bagisto tạo bộ đệm ban đầu, sau đó chạy storefront ở thư mục cha và mở `http://localhost:4317/admin`. Tài khoản demo là `admin@example.com` / `admin123`; đổi mật khẩu nếu dùng ngoài môi trường demo. Xem hướng dẫn đầy đủ ở [SETUP.md](../SETUP.md).

## Phạm vi

Đây là demo B2B: không có checkout, thanh toán, tạo order, tài khoản khách hoặc giao diện quản trị Next.js. Bagisto Admin là giao diện quản trị duy nhất.
