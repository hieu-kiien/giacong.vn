import { z } from "zod";

export const quoteRequestSchema = z.object({
  fullName: z.string().trim().min(2, "Vui lòng nhập họ tên").max(100),
  phone: z.string().trim().regex(/^[0-9+().\s-]{9,20}$/, "Số điện thoại không hợp lệ"),
  email: z.string().trim().email("Email không hợp lệ"),
  company: z.string().trim().max(160).optional(),
  jobTitle: z.string().trim().max(100).optional(),
  services: z.array(z.string()).min(1, "Chọn ít nhất một dịch vụ"),
  categoryId: z.string().optional(),
  productForm: z.string().optional(),
  productDescription: z.string().trim().min(20).max(2000),
  monthlyVolume: z.string().optional(),
  targetLaunchDate: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
  consent: z.literal(true, { error: "Bạn cần đồng ý chính sách bảo mật" }),
  honeypot: z.string().max(0).optional(),
});

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;
