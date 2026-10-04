import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPasswordResetEmail,
  buildVerificationEmail,
  CustomerEmailDeliveryError,
  resolveCustomerEmailConfig,
  sendCustomerEmail,
} from "../src/lib/customer-email.ts";

test("email delivery is off unless both the Resend key and sender are configured", () => {
  assert.equal(resolveCustomerEmailConfig({}), null);
  assert.equal(resolveCustomerEmailConfig({ RESEND_API_KEY: "re_x" }), null);
  assert.equal(resolveCustomerEmailConfig({ CUSTOMER_EMAIL_FROM: "A <a@b.c>" }), null);
  assert.equal(resolveCustomerEmailConfig({ RESEND_API_KEY: "  ", CUSTOMER_EMAIL_FROM: "A <a@b.c>" }), null);
  assert.deepEqual(resolveCustomerEmailConfig({ RESEND_API_KEY: " re_x ", CUSTOMER_EMAIL_FROM: " A <a@b.c> " }), {
    apiKey: "re_x",
    from: "A <a@b.c>",
  });
});

test("sendCustomerEmail posts the message to Resend with a bearer key", async () => {
  let captured: { body: Record<string, unknown>; headers: Record<string, string>; url: string } | null = null;
  const fakeFetch = (async (url: string, init: RequestInit) => {
    captured = { body: JSON.parse(String(init.body)), headers: init.headers as Record<string, string>, url };
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
  await sendCustomerEmail(
    { apiKey: "re_secret", from: "Kienhieu <no-reply@kienhieu.id.vn>" },
    { html: "<p>x</p>", subject: "S", text: "x", to: "lan@example.test" },
    fakeFetch,
  );
  assert.ok(captured);
  const request = captured as { body: Record<string, unknown>; headers: Record<string, string>; url: string };
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.headers.Authorization, "Bearer re_secret");
  assert.deepEqual(request.body.to, ["lan@example.test"]);
  assert.equal(request.body.from, "Kienhieu <no-reply@kienhieu.id.vn>");
});

test("sendCustomerEmail hides provider details when delivery fails", async () => {
  const rejecting = (async () => new Response("secret provider detail", { status: 422 })) as unknown as typeof fetch;
  await assert.rejects(
    sendCustomerEmail({ apiKey: "k", from: "f" }, { html: "", subject: "", text: "", to: "a@b.c" }, rejecting),
    (error: unknown) => error instanceof CustomerEmailDeliveryError && !String((error as Error).message).includes("secret"),
  );
  const throwing = (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
  await assert.rejects(
    sendCustomerEmail({ apiKey: "k", from: "f" }, { html: "", subject: "", text: "", to: "a@b.c" }, throwing),
    CustomerEmailDeliveryError,
  );
});

test("email templates are Vietnamese, include the link and escape user-controlled text", () => {
  const verification = buildVerificationEmail({
    brand: "Kienhieu",
    name: '<script>alert("x")</script>',
    to: "lan@example.test",
    url: "https://kienhieu.id.vn/api/auth/verify-email?token=abc&callbackURL=%2Ftai-khoan%2F",
  });
  assert.match(verification.subject, /Xác nhận email/);
  assert.doesNotMatch(verification.html, /<script>/);
  assert.match(verification.html, /&lt;script&gt;/);
  assert.match(verification.html, /token=abc&amp;callbackURL/);
  assert.match(verification.text, /token=abc&callbackURL/);

  const reset = buildPasswordResetEmail({ brand: "Kienhieu", name: "Lan", to: "lan@example.test", url: "https://kienhieu.id.vn/x" });
  assert.match(reset.subject, /Đặt lại mật khẩu/);
  assert.match(reset.text, /1 giờ/);
});
