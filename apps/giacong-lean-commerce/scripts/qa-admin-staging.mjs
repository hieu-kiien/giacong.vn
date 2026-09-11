// Authenticated, read-only QA for the Cloudflare Access admin hostname.
// Prepare a Playwright storage state after the operator completes Access login,
// then run with QA_ADMIN_STORAGE_STATE=path/to/state.json, or provide a complete
// role map with QA_ADMIN_ROLE_STATES=path/to/role-states.json. This runner never
// clicks, fills, submits, or calls a mutation endpoint. Keyboard navigation is
// used only to verify focus reachability.
import process from "node:process";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { hasRenderedAdminFailure } from "./qa-admin-staging-helpers.mjs";

const baseUrl = (process.env.QA_ADMIN_BASE_URL ?? "https://admin-staging.kienhieu.id.vn").replace(/\/$/, "");
const storageStatePath = process.env.QA_ADMIN_STORAGE_STATE?.trim();
const roleStatesPath = process.env.QA_ADMIN_ROLE_STATES?.trim();
const expectedRole = process.env.QA_ADMIN_EXPECTED_ROLE?.trim().toLowerCase();
const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
];
const motionModes = [
  { name: "default-motion", reducedMotion: "no-preference" },
  { name: "reduced-motion", reducedMotion: "reduce" },
];
const supportedRoles = ["owner"];
const roleLabels = {
  owner: "Admin toàn quyền",
};
const roleNavigationRoutes = {
  owner: ["/admin/noi-dung", "/admin/thiet-ke", "/admin/san-pham", "/admin/dich-vu", "/admin/tin-tuc", "/admin/dieu-huong", "/admin", "/admin/thanh-vien", "/admin/audit"],
};
const adminRoutes = [
  { path: "/admin", heading: "Tổng quan vận hành" },
  { path: "/admin/noi-dung", heading: "Nội dung & thương hiệu" },
  { path: "/admin/thiet-ke", heading: "Thiết kế trang" },
  { path: "/admin/san-pham", heading: "Quản lý sản phẩm" },
  { path: "/admin/dich-vu", heading: "Dịch vụ gia công" },
  { path: "/admin/tin-tuc", heading: "Viết và xuất bản tin tức" },
  { path: "/admin/dieu-huong", heading: "Menu website" },
  { path: "/admin/thanh-vien", heading: "Tài khoản quản trị" },
  { path: "/admin/audit", heading: "Lịch sử thay đổi" },
];

const failures = [];
const check = (name, ok, detail = "") => {
  const label = `${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`;
  console.log(label);
  if (!ok) failures.push(label);
};

function blocked(message) {
  console.error(`ADMIN QA BLOCKED: ${message}`);
  process.exit(2);
}

// RUNNER-A: Cloudflare platform telemetry is not an app mutation.
// POST /cdn-cgi/* (RUM / challenge-platform) plus challenge/insights hosts
// are bypassed from the mutation-violation list; counted + logged separately.
function isPlatformTelemetry(requestUrl) {
  try {
    const parsed = new URL(requestUrl, baseUrl);
    if (parsed.pathname === "/cdn-cgi" || parsed.pathname.startsWith("/cdn-cgi/")) return true;
    if (parsed.hostname === "challenges.cloudflare.com" || parsed.hostname.endsWith(".challenges.cloudflare.com")) return true;
    if (parsed.hostname === "cloudflareinsights.com" || parsed.hostname.endsWith(".cloudflareinsights.com")) return true;
    if (parsed.pathname.includes("__cf_chl")) return true;
    return false;
  } catch {
    return false;
  }
}

async function assertStorageState(path, label) {
  const storageState = resolve(path);
  try {
    await access(storageState);
  } catch {
    blocked(`${label} storage state was not found at ${storageState}.`);
  }
  return storageState;
}

async function loadRoleStates() {
  if (storageStatePath && roleStatesPath) {
    blocked("set either QA_ADMIN_STORAGE_STATE or QA_ADMIN_ROLE_STATES, not both.");
  }

  if (expectedRole && !supportedRoles.includes(expectedRole)) {
    blocked(`QA_ADMIN_EXPECTED_ROLE must be one of ${supportedRoles.join(", ")}.`);
  }

  if (roleStatesPath) {
    if (expectedRole) {
      blocked("QA_ADMIN_EXPECTED_ROLE cannot be used with QA_ADMIN_ROLE_STATES.");
    }

    let parsed;
    const matrixPath = resolve(roleStatesPath);
    try {
      parsed = JSON.parse(await readFile(matrixPath, "utf8"));
    } catch {
      blocked(`role-state map was not valid JSON at ${matrixPath}.`);
    }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      blocked("QA_ADMIN_ROLE_STATES must point to a JSON object mapping every supported role to a storage-state path.");
    }

    const roles = Object.keys(parsed);
    const missingRoles = supportedRoles.filter((role) => !roles.includes(role));
    const unknownRoles = roles.filter((role) => !supportedRoles.includes(role));
    if (missingRoles.length || unknownRoles.length) {
      blocked(`role-state map must contain exactly owner (missing: ${missingRoles.join(", ") || "none"}; unknown: ${unknownRoles.join(", ") || "none"}).`);
    }

    const completeRoleStatePaths = supportedRoles.map((role) => parsed[role]);
    const invalidRole = supportedRoles.find((role) => {
      const path = parsed[role];
      return typeof path !== "string" || !path.trim();
    });
    if (invalidRole) {
      blocked(`${invalidRole} must map to a storage-state JSON path.`);
    }

    const resolvedRoleStatePaths = completeRoleStatePaths.map((path) => resolve(path));
    if (
      new Set(completeRoleStatePaths).size !== completeRoleStatePaths.length
      || new Set(resolvedRoleStatePaths).size !== resolvedRoleStatePaths.length
    ) {
      blocked("each supported role must use a distinct storage-state JSON file.");
    }

    return Promise.all(supportedRoles.map(async (role, index) => ({
      role,
      storageState: await assertStorageState(resolvedRoleStatePaths[index], role),
    })));
  }

  if (!storageStatePath) {
    blocked("set QA_ADMIN_STORAGE_STATE for one identity or QA_ADMIN_ROLE_STATES for the complete role matrix.");
  }

  return [{
    role: expectedRole || "owner",
    storageState: await assertStorageState(storageStatePath, "admin"),
  }];
}

const roleStates = await loadRoleStates();
const matrixMode = Boolean(roleStatesPath);

const browser = await chromium.launch();
try {
  for (const operator of roleStates) {
    const expectedNavigationRoutes = roleNavigationRoutes[operator.role] ?? null;
    const routes = operator.role && matrixMode && expectedNavigationRoutes
      ? adminRoutes.filter((route) => expectedNavigationRoutes.includes(route.path))
      : adminRoutes;
    for (const viewport of viewports) {
      for (const motionMode of motionModes) {
        const context = await browser.newContext({
          storageState: operator.storageState,
          viewport: { width: viewport.width, height: viewport.height },
          reducedMotion: motionMode.reducedMotion,
        });
        const page = await context.newPage();
        const pageIssues = [];
        let telemetryCount = 0;
        const telemetrySamples = [];
        page.on("pageerror", (error) => pageIssues.push(`pageerror: ${error.message}`));
        page.on("request", (request) => {
          if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) return;
          const requestUrl = request.url();
          if (isPlatformTelemetry(requestUrl)) {
            telemetryCount += 1;
            if (telemetrySamples.length < 5) telemetrySamples.push(`${request.method()} ${requestUrl}`);
            return;
          }
          pageIssues.push(`unexpected mutation request: ${request.method()} ${requestUrl}`);
        });
        page.on("console", (message) => {
          if (!["error", "warning"].includes(message.type())) return;
          const url = message.location().url || "";
          if (url.startsWith(baseUrl)) pageIssues.push(`${message.type()}: ${message.text()}`);
        });

        for (const route of routes) {
          const label = `${operator.role ?? "admin"} ${viewport.name} ${motionMode.name} ${route.path}`;
          let response;
          try {
            response = await page.goto(`${baseUrl}${route.path}`, {
              waitUntil: "domcontentloaded",
              timeout: 45_000,
            });
          } catch (error) {
            check(`${label} navigation`, false, error instanceof Error ? error.message : String(error));
            continue;
          }
          check(`${label} status`, response?.status() === 200, `status=${response?.status()}`);
          const heading = page.locator("h1").first();
          const rendered = await heading.waitFor({ state: "visible", timeout: 15_000 }).then(() => true).catch(() => false);
          check(`${label} main rendered`, rendered);
          if (!rendered) continue;

          const actualHeading = (await heading.innerText()).trim();
          check(
            `${label} heading`,
            actualHeading === route.heading,
            `"${actualHeading}"`,
          );
          const bodyText = await page.locator("body").innerText();
          check(
            `${label} has no rendered admin failure`,
            !hasRenderedAdminFailure(bodyText),
          );
          check(
            `${label} no horizontal overflow`,
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
          );
          const motionPreference = await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
          check(
            `${label} reduced-motion preference`,
            motionMode.reducedMotion === "reduce" ? motionPreference : !motionPreference,
            motionMode.reducedMotion,
          );
          const focusableSelector = "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])";
          await page.keyboard.press("Tab");
          const focusState = await page.evaluate((selector) => {
            const active = document.activeElement;
            if (!(active instanceof HTMLElement)) return { focusable: false, visible: false, target: "none" };
            const rect = active.getBoundingClientRect();
            const styles = getComputedStyle(active);
            return {
              focusable: active.matches(selector),
              visible: rect.width > 0 && rect.height > 0 && styles.visibility !== "hidden" && styles.display !== "none",
              target: `${active.tagName.toLowerCase()}${active.id ? `#${active.id}` : ""}`,
            };
          }, focusableSelector);
          check(
            `${label} keyboard Tab reaches visible focusable target`,
            focusState.focusable && focusState.visible,
            focusState.target,
          );
          if (operator.role) {
            const roleMarker = roleLabels[operator.role] ?? operator.role;
            const normalizedBody = bodyText.toLocaleLowerCase("vi");
            // RUNNER-A (b): mobile <760px hides .admin-role-label via display:none,
            // so body innerText omits it by design. Fall back to DOM textContent
            // (includes hidden marker). No UI/CSS change, no redesign.
            const domText = await page.evaluate(() => document.body.textContent ?? "");
            const normalizedDom = domText.toLocaleLowerCase("vi");
            const roleLabelDom = await page.locator(".admin-role-label").first().textContent().catch(() => "");
            const normalizedLabel = (roleLabelDom ?? "").toLocaleLowerCase("vi");
            const expectedRoleKey = operator.role.toLocaleLowerCase("vi");
            const expectedLabel = roleMarker.toLocaleLowerCase("vi");
            check(
              `${label} expected role`,
              normalizedBody.includes(expectedRoleKey) || normalizedBody.includes(expectedLabel)
                || normalizedDom.includes(expectedRoleKey) || normalizedDom.includes(expectedLabel)
                || normalizedLabel.includes(expectedRoleKey) || normalizedLabel.includes(expectedLabel),
              roleMarker,
            );
          }

          if (matrixMode && operator.role && route.path === "/admin") {
            const actualNavigationRoutes = await page.locator('nav[aria-label="Các khu vực quản trị"] a[href^="/admin"]').evaluateAll((links) => (
              links.map((link) => link.getAttribute("href")).filter(Boolean)
            ));
            check(
              `${operator.role} ${viewport.name} ${motionMode.name} navigation route matrix`,
              JSON.stringify(actualNavigationRoutes) === JSON.stringify(expectedNavigationRoutes),
              `expected=${expectedNavigationRoutes.join(",")} actual=${actualNavigationRoutes.join(",")}`,
            );
            for (const route of adminRoutes) {
              const expectedVisible = expectedNavigationRoutes.includes(route.path);
              const actualVisible = actualNavigationRoutes.includes(route.path);
              check(
                `${operator.role} ${viewport.name} ${motionMode.name} ${route.path} sidebar visibility`,
                actualVisible === expectedVisible,
                `expected=${expectedVisible ? "visible" : "hidden"} actual=${actualVisible ? "visible" : "hidden"}`,
              );
            }
          }
        }

        if (telemetryCount > 0) {
          console.log(`telemetry ${operator.role ?? "admin"} ${viewport.name} ${motionMode.name}: ${telemetryCount} Cloudflare platform request(s) bypassed (${telemetrySamples.join(" | ")})`);
        }
        check(`${operator.role ?? "admin"} ${viewport.name} ${motionMode.name} admin console clean`, pageIssues.length === 0, pageIssues.join(" | "));
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}

console.log(failures.length ? `\nADMIN STAGING QA FAILED: ${failures.length} check(s)` : "\nADMIN STAGING QA PASSED");
process.exit(failures.length ? 1 : 0);
