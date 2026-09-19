import { PolicyPage, policyMetadata } from "@/components/site/PolicyPage";

export async function generateMetadata() {
  return policyMetadata("shipping");
}

export default function ShippingPolicyPage() {
  return <PolicyPage policyKey="shipping" />;
}
