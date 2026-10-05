import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (...parts) => readFile(new URL(`../src/${parts.join("/")}`, import.meta.url), "utf8");

test("customer auth keeps e-mail sign-up closed unless Resend is configured", async () => {
  const auth = await read("lib", "customer-auth.ts");

  assert.match(auth, /resolveCustomerEmailConfig\(environment\)/);
  assert.match(auth, /disableSignUp: !emailConfig/);
  assert.match(auth, /requireEmailVerification: true/);
  assert.match(auth, /sendResetPassword: emailConfig/);
  assert.match(auth, /sendVerificationEmail: async/);
  assert.match(auth, /sendOnSignUp: true/);
  assert.doesNotMatch(auth, /disableSignUp: true/);
  // Secrets are read from the Cloudflare environment, never hard-coded.
  assert.doesNotMatch(auth, /re_[A-Za-z0-9]{10,}/);
  assert.match(auth, /RESEND_API_KEY\?: string/);
  assert.match(auth, /CUSTOMER_EMAIL_FROM\?: string/);
});

test("login screen offers Google, e-mail sign-up with optional username, resend and forgot password", async () => {
  const ui = await read("app", "(storefront)", "tai-khoan", "dang-nhap", "CustomerAccountAuth.tsx");

  assert.match(ui, /customerAuthClient\.signUp\.email\(/);
  assert.match(ui, /customerAuthClient\.requestPasswordReset\(/);
  assert.match(ui, /customerAuthClient\.sendVerificationEmail\(/);
  assert.match(ui, /EMAIL_NOT_VERIFIED/);
  assert.match(ui, /không bắt buộc/);
  assert.match(ui, /signInWithGoogle\(callbackURL\)/);
  // Reset requests answer identically for known and unknown e-mail addresses.
  assert.match(ui, /Nếu email này có tài khoản/);
});

test("password reset page rejects missing tokens and posts the new password with the token", async () => {
  const [page, form] = await Promise.all([
    read("app", "(storefront)", "tai-khoan", "dat-lai-mat-khau", "page.tsx"),
    read("app", "(storefront)", "tai-khoan", "dat-lai-mat-khau", "ResetPasswordForm.tsx"),
  ]);

  assert.match(page, /const linkInvalid = !token \|\| query\.error === "INVALID_TOKEN"/);
  assert.match(page, /noIndexMetadata\(\)/);
  assert.match(form, /customerAuthClient\.resetPassword\(\{ newPassword: password, token \}\)/);
  assert.match(form, /password !== confirmation/);
});

test("account password forms are visible without opening a disclosure", async () => {
  const ui = await read("app", "(storefront)", "tai-khoan", "dang-nhap", "CustomerAccountAuth.tsx");
  assert.doesNotMatch(ui, /<details className=\{styles\.passwordOption\}>/);
  assert.match(ui, /hoặc dùng email và mật khẩu/);
  assert.match(ui, /Đăng ký bằng email đang được thiết lập/);
});

test("admin can control new e-mail registration without disabling existing sign-in", async () => {
  const [settings, route, ui] = await Promise.all([
    read("lib", "site-settings.ts"),
    read("app", "api", "auth", "[...all]", "route.ts"),
    read("app", "admin", "noi-dung", "page.tsx"),
  ]);
  assert.match(settings, /key: "customer_email_registration"/);
  assert.match(settings, /definition.key === "customer_email_registration"/);
  assert.match(route, /\/sign-up\/email/);
  assert.match(route, /isCustomerEmailRegistrationAllowed/);
  assert.match(ui, /Bật đăng ký bằng email/);
});

test("registration policy reads published values fresh and fails closed on storage failure", async () => {
  const { isCustomerEmailRegistrationAllowed } = await import("../src/lib/customer-registration-policy.ts");
  let row = null;
  const database = { prepare: () => ({ first: async () => row }) };
  assert.equal(await isCustomerEmailRegistrationAllowed(database), true);
  row = { published_value: "off", draft_value: "on" };
  assert.equal(await isCustomerEmailRegistrationAllowed(database), false);
  row = { published_value: "on", draft_value: "off" };
  assert.equal(await isCustomerEmailRegistrationAllowed(database), true);
  row = { published_value: "unexpected" };
  assert.equal(await isCustomerEmailRegistrationAllowed(database), false);
  await assert.rejects(isCustomerEmailRegistrationAllowed({ prepare: () => { throw new Error("unavailable"); } }));
});

test("turning off registration preserves password reset and verification resend", async () => {
  const ui = await read("app", "(storefront)", "tai-khoan", "dang-nhap", "CustomerAccountAuth.tsx");
  assert.match(ui, /emailDeliveryEnabled \? <button[^\n]+button-auth-forgot/);
  assert.match(ui, /if \(emailDeliveryEnabled && value.includes/);
});
