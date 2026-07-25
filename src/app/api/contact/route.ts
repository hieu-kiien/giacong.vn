import { handleContactSubmission } from "@/lib/contact-webhook";

export async function POST(request: Request) {
  return handleContactSubmission(request, { environment: process.env });
}
