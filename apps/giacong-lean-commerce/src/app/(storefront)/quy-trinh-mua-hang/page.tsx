import { PolicyPage, policyMetadata } from "@/components/site/PolicyPage";

export const metadata = policyMetadata("purchase-process");

export default function PurchaseProcessPage() {
  return <PolicyPage policyKey="purchase-process" />;
}
