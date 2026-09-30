const renderedAdminFailurePattern = /Khu vực này cần Cloudflare Access|Đăng nhập Cloudflare Access|Đăng nhập để vào khu vực quản trị|Tài khoản chưa được cấp quyền admin|Phiên quản trị không hợp lệ|Không thể tải dữ liệu|Đã xảy ra lỗi|Worker exceeded resource limits|\b1102\b|\b502\b|\b503\b/i;

export function hasRenderedAdminFailure(bodyText) {
  return renderedAdminFailurePattern.test(bodyText);
}
