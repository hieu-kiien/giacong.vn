/**
 * Transactional e-mail for customer accounts (verification + password reset),
 * sent through the Resend REST API. Kept free of framework imports so it can be
 * unit-tested; the API key and sender address come from Cloudflare secrets.
 */

export interface CustomerEmailEnvironment {
  CUSTOMER_EMAIL_FROM?: string;
  RESEND_API_KEY?: string;
}

export interface CustomerEmailConfig {
  apiKey: string;
  from: string;
}

export interface CustomerEmailMessage {
  html: string;
  subject: string;
  text: string;
  to: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export class CustomerEmailDeliveryError extends Error {
  constructor() {
    super("Customer email delivery failed.");
    this.name = "CustomerEmailDeliveryError";
  }
}

/** Returns null (feature off) unless both the API key and sender are configured. */
export function resolveCustomerEmailConfig(environment: CustomerEmailEnvironment): CustomerEmailConfig | null {
  const apiKey = environment.RESEND_API_KEY?.trim();
  const from = environment.CUSTOMER_EMAIL_FROM?.trim();
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

export async function sendCustomerEmail(
  config: CustomerEmailConfig,
  message: CustomerEmailMessage,
  fetchImplementation: typeof fetch = fetch,
): Promise<void> {
  let response: Response;
  try {
    response = await fetchImplementation(RESEND_ENDPOINT, {
      body: JSON.stringify({
        from: config.from,
        html: message.html,
        subject: message.subject,
        text: message.text,
        to: [message.to],
      }),
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch {
    throw new CustomerEmailDeliveryError();
  }
  if (!response.ok) throw new CustomerEmailDeliveryError();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(brand: string, heading: string, intro: string, actionLabel: string, url: string, footnote: string): string {
  const safeUrl = escapeHtml(url);
  return `<!doctype html><html lang="vi"><body style="margin:0;background:#f5f9f1;font-family:Arial,Helvetica,sans-serif;color:#243223;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2eadc;border-radius:16px;">
<tr><td style="padding:28px 28px 8px;font-size:18px;font-weight:700;color:#315f19;">${escapeHtml(brand)}</td></tr>
<tr><td style="padding:0 28px;font-size:22px;font-weight:700;">${escapeHtml(heading)}</td></tr>
<tr><td style="padding:12px 28px;font-size:15px;line-height:1.6;">${escapeHtml(intro)}</td></tr>
<tr><td style="padding:8px 28px 20px;"><a href="${safeUrl}" style="display:inline-block;background:#3f7a25;color:#ffffff;text-decoration:none;font-weight:700;border-radius:10px;padding:13px 22px;">${escapeHtml(actionLabel)}</a></td></tr>
<tr><td style="padding:0 28px 8px;font-size:12px;line-height:1.6;color:#5e695c;">Nếu nút không bấm được, hãy sao chép liên kết này vào trình duyệt:<br><span style="word-break:break-all;">${safeUrl}</span></td></tr>
<tr><td style="padding:8px 28px 28px;font-size:12px;line-height:1.6;color:#5e695c;">${escapeHtml(footnote)}</td></tr>
</table></td></tr></table></body></html>`;
}

export function buildVerificationEmail(input: { brand: string; name: string; to: string; url: string }): CustomerEmailMessage {
  const greeting = input.name.trim() ? `Chào ${input.name.trim()}, ` : "Chào bạn, ";
  const intro = `${greeting}bấm nút bên dưới để xác nhận email và hoàn tất đăng ký tài khoản.`;
  return {
    html: layout(input.brand, "Xác nhận email của bạn", intro, "Xác nhận email", input.url, "Liên kết có hiệu lực trong 24 giờ. Nếu bạn không đăng ký, hãy bỏ qua email này."),
    subject: `Xác nhận email tài khoản ${input.brand}`,
    text: `${intro}\n\n${input.url}\n\nLiên kết có hiệu lực trong 24 giờ. Nếu bạn không đăng ký, hãy bỏ qua email này.`,
    to: input.to,
  };
}

export function buildPasswordResetEmail(input: { brand: string; name: string; to: string; url: string }): CustomerEmailMessage {
  const greeting = input.name.trim() ? `Chào ${input.name.trim()}, ` : "Chào bạn, ";
  const intro = `${greeting}chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản này. Bấm nút bên dưới để đặt mật khẩu mới.`;
  return {
    html: layout(input.brand, "Đặt lại mật khẩu", intro, "Đặt mật khẩu mới", input.url, "Liên kết có hiệu lực trong 1 giờ. Nếu bạn không yêu cầu, hãy bỏ qua email này — mật khẩu hiện tại vẫn an toàn."),
    subject: `Đặt lại mật khẩu ${input.brand}`,
    text: `${intro}\n\n${input.url}\n\nLiên kết có hiệu lực trong 1 giờ. Nếu bạn không yêu cầu, hãy bỏ qua email này.`,
    to: input.to,
  };
}
