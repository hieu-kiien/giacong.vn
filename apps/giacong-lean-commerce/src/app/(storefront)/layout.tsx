// Imports the same `public/styles/` sheets that used to ship as `<link>` tags,
// but inside the `captured` cascade layer so Tailwind utilities can override
// them. See the comment in the file itself.
import "./captured-layers.css";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
