import { PolicyPage, policyMetadata } from "@/components/site/PolicyPage";

export async function generateMetadata() {
  return policyMetadata("terms");
}

export default function TermsPage() {
  return <PolicyPage policyKey="terms" />;
}
