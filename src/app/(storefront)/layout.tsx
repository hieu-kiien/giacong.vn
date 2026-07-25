import { StorefrontShell } from "@/components/storefront/StorefrontShell";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return <StorefrontShell>{children}</StorefrontShell>;
}
