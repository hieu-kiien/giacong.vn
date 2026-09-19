import { PolicyPage, policyMetadata } from "@/components/site/PolicyPage";

export async function generateMetadata() {
  return policyMetadata("purchase-process");
}

export default function PurchaseProcessPage() {
  return <PolicyPage policyKey="purchase-process" />;
}
