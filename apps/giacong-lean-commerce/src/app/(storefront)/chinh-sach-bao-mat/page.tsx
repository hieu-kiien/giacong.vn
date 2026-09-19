import { PolicyPage, policyMetadata } from "@/components/site/PolicyPage";

export async function generateMetadata() {
  return policyMetadata("privacy");
}

export default function PrivacyPolicyPage() {
  return <PolicyPage policyKey="privacy" />;
}
