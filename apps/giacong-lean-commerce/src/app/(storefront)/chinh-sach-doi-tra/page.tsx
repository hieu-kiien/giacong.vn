import { PolicyPage, policyMetadata } from "@/components/site/PolicyPage";

export const metadata = policyMetadata("returns");

export default function ReturnsPolicyPage() {
  return <PolicyPage policyKey="returns" />;
}
