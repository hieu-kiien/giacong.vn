import { getCustomerSession } from "@/lib/customer-auth";
import { getAdminDatabase } from "@/lib/admin-data";
import { getCustomerContact, saveCustomerContact } from "@/lib/customer-contact-data";
import { parseCustomerContact } from "@/lib/customer-contact-input";

export const dynamic = "force-dynamic";
const responseHeaders = { "Cache-Control": "private, no-store" };

async function verifiedCustomer(request: Request) {
  const session = await getCustomerSession(request.headers);
  return session?.user.emailVerified ? session.user : null;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await verifiedCustomer(request);
    if (!user) return Response.json({ ok: false, message: "Vui lòng đăng nhập để xem thông tin liên hệ." }, { status: 401, headers: responseHeaders });
    const contact = await getCustomerContact(getAdminDatabase(), user.id);
    return Response.json({ ok: true, contact: { name: contact?.name ?? user.name, phone: contact?.phone ?? "", companyName: contact?.companyName ?? "", email: user.email } }, { headers: responseHeaders });
  } catch {
    return Response.json({ ok: false, message: "Chưa tải được thông tin liên hệ. Vui lòng thử lại." }, { status: 503, headers: responseHeaders });
  }
}

export async function PUT(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  if (origin !== url.origin || request.headers.get("host")?.toLowerCase() !== url.host.toLowerCase()) {
    return Response.json({ ok: false, message: "Yêu cầu không hợp lệ. Vui lòng tải lại trang." }, { status: 403, headers: responseHeaders });
  }
  if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") ?? "")) {
    return Response.json({ ok: false, message: "Thông tin không hợp lệ." }, { status: 415, headers: responseHeaders });
  }
  try {
    const user = await verifiedCustomer(request);
    if (!user) return Response.json({ ok: false, message: "Phiên đăng nhập đã hết. Vui lòng đăng nhập lại." }, { status: 401, headers: responseHeaders });
    const body = await request.text();
    if (body.length > 4096) return Response.json({ ok: false, message: "Thông tin quá dài." }, { status: 413, headers: responseHeaders });
    let raw: unknown;
    try { raw = JSON.parse(body); } catch {
      return Response.json({ ok: false, message: "Thông tin không hợp lệ." }, { status: 400, headers: responseHeaders });
    }
    const parsed = parseCustomerContact(raw);
    if (!parsed.ok) return Response.json({ ok: false, errors: parsed.errors, message: "Vui lòng kiểm tra thông tin liên hệ." }, { status: 422, headers: responseHeaders });
    await saveCustomerContact(getAdminDatabase(), user.id, parsed.value);
    return Response.json({ ok: true, message: "Đã lưu thông tin liên hệ." }, { headers: responseHeaders });
  } catch {
    return Response.json({ ok: false, message: "Chưa lưu được thông tin. Vui lòng thử lại." }, { status: 503, headers: responseHeaders });
  }
}
