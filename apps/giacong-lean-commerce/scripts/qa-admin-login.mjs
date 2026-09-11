// Helper: open the staging admin in a real browser window so the owner can
// log in through Cloudflare Access by hand, then save the session to a file
// that `npm run qa:admin-staging` accepts via QA_ADMIN_STORAGE_STATE.
// Usage: QA_ADMIN_BASE_URL=https://admin-staging.kienhieu.id.vn node scripts/qa-admin-login.mjs ./admin-storage-state.json
// Nothing is clicked, filled or submitted by this script.
import process from "node:process";
import { chromium } from "playwright";

const baseUrl = (process.env.QA_ADMIN_BASE_URL ?? "https://admin-staging.kienhieu.id.vn").replace(/\/$/, "");
const outputPath = process.argv[2] ?? "admin-storage-state.json";

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
console.log("Trình duyệt đã mở trang quản trị.");
console.log("Bạn hãy đăng nhập Cloudflare Access bằng tay cho xong, rồi quay lại cửa sổ lệnh này bấm Enter.");
await new Promise((resolve) => process.stdin.once("data", resolve));
await context.storageState({ path: outputPath });
console.log(`Đã lưu phiên đăng nhập vào ${outputPath}. Giữ file này cẩn thận, đừng đưa lên mạng.`);
await browser.close();
