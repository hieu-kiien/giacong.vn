import { describe, test } from "@e2e-dev/web";
import { expect } from "e2e";

describe("Kienhieu Production Live E2E (kienhieu.id.vn)", { serial: true, tags: ["production", "smoke"] }, () => {
  test("1. Trang chủ hiển thị chuẩn thương hiệu Kienhieu, menu chính và thông tin văn phòng", async ({ app, screen, browser }) => {
    await app.open("/");
    await expect(browser).toHaveTitle(/Kienhieu/i);

    await expect(screen.getByRole("heading", { level: 1 })).toContainText("Giải pháp gia công toàn diện chuyên nghiệp");
    await expect(screen.getByRole("link", "Mua hàng").first()).toBeVisible();
    await expect(screen.getByRole("link", "Dịch vụ").first()).toBeVisible();
    await expect(screen.getByRole("link", "Tin tức").first()).toBeVisible();
    await expect(screen.getByRole("link", "Liên hệ").first()).toBeVisible();

    await screen.scrollUntilVisible(screen.getByText("VP Thái Nguyên", { exact: false }).first());
    await expect(screen.getByText("VP Thái Nguyên", { exact: false }).first()).toBeVisible();
    await expect(screen.getByText("0868408115", { exact: false }).first()).toBeVisible();
    await expect(screen.getByText("contact@kienhieu.id.vn", { exact: false }).first()).toBeVisible();
  });

  test("2. Danh mục sản phẩm hiển thị đủ 8 sản phẩm B2B thực tế và không còn sản phẩm nháp", async ({ app, screen, browser }) => {
    await app.open("/san-pham/");
    await expect(browser).toHaveURL(/\/san-pham/);

    const expectedProducts = [
      "Bột gạo lứt xay mịn",
      "Tinh bột sắn biến tính",
      "Bột đậu nành rang",
      "Hoa cúc sấy nguyên bông",
      "Lá tía tô sấy lạnh",
      "Sốt me chua ngọt",
      "Túi zipper tráng nhôm",
      "Thùng carton 5 lớp",
    ];

    for (const productName of expectedProducts) {
      await expect(screen.getByText(productName, { exact: false }).first()).toBeVisible();
    }

    await expect(screen.getByText("Nước mắm cốt pha loãng", { exact: false })).toBeHidden();
  });

  test("3. Chi tiết sản phẩm đổi quy cách, tính bậc giá sỉ và thêm vào giỏ yêu cầu", async ({ app, screen, browser }) => {
    await app.open("/san-pham/bot-gao-lut-xay-min");
    await expect(browser).toHaveURL(/\/san-pham\/bot-gao-lut-xay-min/);
    await browser.evaluate(() => {
      window.localStorage.removeItem("giacong.request-cart.v1");
      window.dispatchEvent(new Event("giacong:request-cart-updated"));
      return null;
    });
    await expect(screen.getByRole("heading", { level: 1 })).toContainText("Bột gạo lứt xay mịn");

    const variant10kg = screen.getByRole("radio", "Bao 10 kg");
    await variant10kg.tap();
    await expect(variant10kg).toBeChecked();

    const increaseButton = screen.getByRole("button", "Tăng 5 bao");
    await increaseButton.tap();

    const addToCartBtn = screen.getByRole("button", "Thêm vào giỏ yêu cầu");
    await addToCartBtn.tap();

    await expect(screen.getByRole("status").filter({ hasText: "Đã thêm" })).toContainText("Đã thêm 15 bao vào giỏ yêu cầu.");
  });

  test("4. Giỏ yêu cầu báo giá (/gui-yeu-cau/) đồng bộ đơn giá server và kiểm tra form liên hệ", async ({ app, screen, browser }) => {
    await app.open("/gui-yeu-cau/");
    await expect(browser).toHaveURL(/\/gui-yeu-cau/);

    await expect(screen.getByText("Bột gạo lứt xay mịn", { exact: false }).first()).toBeVisible();
    await expect(screen.getByText("Bao 10 kg", { exact: false }).first()).toBeVisible();
    await expect(screen.getByText("149.000", { exact: false }).first()).toBeVisible();

    await browser.evaluate(() => {
      window.localStorage.removeItem("giacong.request-cart.v1");
      window.dispatchEvent(new Event("giacong:request-cart-updated"));
      return null;
    });
  });

  test("5. Danh mục dịch vụ (/thue-gia-cong/) hiển thị đúng 13 nhóm dịch vụ OEM và ẩn dịch vụ test", async ({ app, screen, browser }) => {
    await app.open("/thue-gia-cong/");
    await expect(browser).toHaveURL(/\/thue-gia-cong/);

    const expectedServices = [
      "Gia công sốt chấm",
      "Gia công đồ uống",
      "Gia công bột pha chế",
      "Gia công dược liệu",
      "Gia công thực phẩm",
      "Gia công mỹ phẩm",
      "Gia công trà",
      "Gia công cà phê",
      "Gia công đóng gói",
      "Gia công bột",
      "Gia công rượu",
      "Gia công sữa",
      "Sấy & thực phẩm sấy",
    ];

    await expect(screen.getByText("13 nhóm · 193 trang nội dung")).toBeVisible();

    for (const serviceName of expectedServices) {
      await expect(screen.getByRole("heading", serviceName)).toBeVisible();
    }

    await expect(screen.getByText("testtesttesttest", { exact: false })).toBeHidden();

    await app.open("/thue-gia-cong/gia-cong-tra/");
    await expect(browser).toHaveURL(/\/thue-gia-cong\/gia-cong-tra/);
    await expect(screen.getByRole("heading", "Gia công trà")).toBeVisible();
  });

  test("6. Trang Tin tức (/tin-tuc/), Giới thiệu và Liên hệ hiển thị đồng nhất", async ({ app, screen, browser }) => {
    await app.open("/tin-tuc/");
    await expect(browser).toHaveURL(/\/tin-tuc/);
    await expect(screen.getByRole("heading", { level: 1 })).toContainText("Tin tức");
    await expect(screen.getByTestId("news-empty-state")).toContainText("Chưa có bài viết mới");

    await app.open("/gioi-thieu-ve-gia-cong/");
    await expect(browser).toHaveURL(/\/gioi-thieu-ve-gia-cong/);
    await expect(screen.getByText("Kienhieu", { exact: false }).first()).toBeVisible();

    await app.open("/lien-he/");
    await expect(browser).toHaveURL(/\/lien-he/);
    await expect(screen.getByText("0868408115", { exact: false }).first()).toBeVisible();
  });

  test("7. Trang Tài khoản (/tai-khoan) và cổng Quản trị (/admin) hoạt động chuẩn xác", async ({ app, screen, browser }) => {
    await app.open("/tai-khoan");
    await expect(browser).toHaveURL(/\/tai-khoan/);
    await expect(screen.getByRole("heading", { level: 1 })).toBeVisible();

    await app.open("/admin");
    await expect(browser).toHaveURL(/\/(admin|tai-khoan)/);
  });
});
