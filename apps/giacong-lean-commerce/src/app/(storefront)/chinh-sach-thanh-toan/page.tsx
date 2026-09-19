import { PolicyPage, policyMetadata } from "@/components/site/PolicyPage";

export async function generateMetadata() {
  return policyMetadata("payment");
}

export default function PaymentPolicyPage() {
  return <PolicyPage policyKey="payment" />;
}
