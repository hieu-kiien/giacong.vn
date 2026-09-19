import { PolicyPage, policyMetadata } from "@/components/site/PolicyPage";

export async function generateMetadata() {
  return policyMetadata("returns");
}

export default function ReturnsPolicyPage() {
  return <PolicyPage policyKey="returns" />;
}
