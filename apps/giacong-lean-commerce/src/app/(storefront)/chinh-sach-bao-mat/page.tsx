import { PolicyPage, policyMetadata } from "@/components/site/PolicyPage";

export const metadata = policyMetadata("privacy");

export default function PrivacyPolicyPage() {
  return <PolicyPage policyKey="privacy" />;
}
