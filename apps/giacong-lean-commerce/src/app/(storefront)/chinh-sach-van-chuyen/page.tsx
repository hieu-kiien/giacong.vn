import { PolicyPage, policyMetadata } from "@/components/site/PolicyPage";

export const metadata = policyMetadata("shipping");

export default function ShippingPolicyPage() {
  return <PolicyPage policyKey="shipping" />;
}
