"use server";

import { headers } from "next/headers";

import { getCustomerAuthForHeaders } from "@/lib/customer-auth";

export async function setCustomerAccountPassword(newPassword: string) {
  if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 128) {
    return { ok: false as const, message: "Mật khẩu cần có từ 8 đến 128 ký tự." };
  }

  try {
    const requestHeaders = await headers();
    const auth = getCustomerAuthForHeaders(requestHeaders);
    const session = await auth.api.getSession({ headers: requestHeaders });

    if (!session?.user.id || !session.user.emailVerified) {
      return { ok: false as const, message: "Hãy đăng nhập bằng Google đã xác minh email rồi thử lại." };
    }

    await auth.api.setPassword({ body: { newPassword }, headers: requestHeaders });
    return { ok: true as const };
  } catch {
    return {
      ok: false as const,
      message: "Phiên đăng nhập đã hết hạn hoặc mật khẩu đã được tạo. Hãy đăng nhập lại bằng Google rồi thử lại.",
    };
  }
}
