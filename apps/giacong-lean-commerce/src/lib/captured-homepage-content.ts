/** Replace captured homepage claims that have not been verified by the owner. */
export function sanitizeCapturedHomepageCopy(markup: string): string {
  return markup
    .replace(/Sẵn sàng tiếp cận/giu, "Trao đổi kế hoạch gia công cùng")
    .replace(/hàng triệu khách hàng tiềm năng\?/giu, "Kienhieu?")
    .replace(/Hotline hỗ trợ\s*24\/7/giu, "Hotline tư vấn");
}
