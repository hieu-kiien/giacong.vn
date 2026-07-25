# Kế hoạch Bagisto headless MVP — lưu trữ

> **Đã thay thế.** Đây là tài liệu lịch sử, không còn là mô tả hiện trạng hoặc phạm vi triển khai. Nguồn quyết định duy nhất là [COMMERCE_PLATFORM_MASTER_PLAN.md](./COMMERCE_PLATFORM_MASTER_PLAN.md).

Một số đề xuất lịch sử trong tài liệu cũ — inbox/yêu cầu trong Bagisto, đồng bộ Google Sheet từ Bagisto, xác thực email ở persistence Bagisto, và workflow báo giá — không áp dụng cho Lean V1.

Hiện tại, `POST /api/contact` xác thực dữ liệu ở Next.js và gửi webhook server-to-server tới Google Apps Script/Google Sheets. Xem hướng dẫn triển khai tại [GOOGLE_SHEETS_CONTACT_WEBHOOK.md](./GOOGLE_SHEETS_CONTACT_WEBHOOK.md).
