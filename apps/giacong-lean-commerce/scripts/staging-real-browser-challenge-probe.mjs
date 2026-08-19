import { chromium } from "playwright";

const origin = (process.env.STAGING_ORIGIN || "https://staging.kienhieu.id.vn").replace(/\/$/, "");
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext();
  const page = await context.newPage();

  const firstResponse = await page.goto(`${origin}/`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  await page.waitForTimeout(12_000);

  const titleAfterChallenge = await page.title();
  const cookiesAfterChallenge = await context.cookies(origin);
  const hasClearance = cookiesAfterChallenge.some((cookie) => cookie.name === "cf_clearance");

  const reloadResponse = await page.reload({
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  const finalTitle = await page.title();
  const finalUrl = page.url();
  const firstStatus = firstResponse?.status() ?? 0;
  const reloadStatus = reloadResponse?.status() ?? 0;
  const challenged =
    firstStatus === 403 ||
    reloadStatus === 403 ||
    /just a moment/i.test(titleAfterChallenge) ||
    /just a moment/i.test(finalTitle);

  console.log(
    "STAGING_REAL_BROWSER_PROBE",
    JSON.stringify({
      firstStatus,
      reloadStatus,
      hasClearance,
      challenged,
      titleAfterChallenge,
      finalTitle,
      finalUrl,
    }),
  );
} finally {
  await browser.close();
}
