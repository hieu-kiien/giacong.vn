import { PolicyPage, policyMetadata } from "@/components/site/PolicyPage";

export const metadata = policyMetadata("terms");

export default function TermsPage() {
  return <PolicyPage policyKey="terms" />;
}
