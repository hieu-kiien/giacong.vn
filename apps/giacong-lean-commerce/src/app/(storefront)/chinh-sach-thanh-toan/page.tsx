import { PolicyPage, policyMetadata } from "@/components/site/PolicyPage";

export const metadata = policyMetadata("payment");

export default function PaymentPolicyPage() {
  return <PolicyPage policyKey="payment" />;
}
