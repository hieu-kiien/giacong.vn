import Link from "next/link";

import { CommerceRail } from "@/components/commerce/CommerceRail";
import { COMMERCE_CONTACT_CHANNELS } from "@/components/commerce/commerce-navigation";

/**
 * Commerce footer: the four-column close the captured pages carry, rebuilt in
 * Tailwind so the product and service routes end the same way the rest of the site
 * does without pulling in the captured cascade.
 *
 * What is kept from the captured footer: the column widths (4/2/2/4 of twelve), the
 * company blurb, the "Các dịch vụ chính" and "Chính sách chung" headings, and the
 * pale copyright strip with its 1px top rule.
 *
 * What is deliberately dropped. The captured policy column holds five links, four of
 * them pointing at a bare fragment, and two of those name surfaces V1 does not have —
 * so only the one page that exists is linked. The social icons point at a placeholder
 * host. Rebuilding either would ship a dead control. The two protection badges at the
 * bottom are third-party assets this project has no licence for.
 *
 * The contact block reads `COMMERCE_CONTACT_CHANNELS` instead of the captured
 * values. Those captured values — a different hotline, an `@giacong.vn` mailbox and
 * two site addresses — are the real business's own contact details; the master plan
 * publishes a separate demo set for the request handoff, and the header, support
 * strip and floating cluster already read it. `scripts/commerce-header.test.mts`
 * asserts the captured ones stay out.
 *
 * The wordmark is set as text for the same reason as in the header: no logo asset is
 * licensed for this project.
 */

/** Service hubs the captured footer links, each an existing route. */
const FOOTER_SERVICE_LINKS = [
  { href: "/gia-cong-do-uong/", label: "Gia công đồ uống" },
  { href: "/gia-cong-duoc-lieu/", label: "Gia công dược liệu" },
  { href: "/gia-cong-thuc-pham/", label: "Gia công thực phẩm" },
  { href: "/gia-cong-my-pham/", label: "Gia công mỹ phẩm" },
  { href: "/gia-cong-sua/", label: "Gia công sữa" },
  { href: "/dich-vu-say/", label: "Gia công sấy" },
] as const;

const FOOTER_POLICY_LINKS = [{ href: "/chinh-sach-bao-mat/", label: "Chính sách bảo mật" }] as const;

const COMPANY_BLURB =
  "Giacong.vn cam kết mang đến cho khách hàng những sản phẩm an toàn, đảm bảo vệ sinh và có giá trị dinh dưỡng cao. Không ngừng phát triển và cải tiến, Giacong.vn luôn sẵn sàng hợp tác và gia công theo yêu cầu của các đối tác trong và ngoài nước, đáp ứng đa dạng nhu cầu từ thực phẩm tươi sống đến các sản phẩm chế biến sẵn.";

const LEGAL_NAME = "VIET NAM TRADE PROMOTION DEVELOPMENT INVESTMENT .,JSC";

const linkClass =
  "inline-flex min-h-9 items-center text-commerce-body transition-colors hover:text-commerce-brand-dark focus-visible:commerce-focus-ring motion-reduce:transition-none";

function FooterColumnHeading({ children, id }: { children: string; id?: string }) {
  return (
    <h2 className="mb-3 text-base font-bold text-commerce-body" id={id}>
      {children}
    </h2>
  );
}

export function CommerceFooter() {
  return (
    <footer className="mt-16 border-t border-commerce-border bg-white text-[15px] text-commerce-body">
      <CommerceRail className="grid gap-8 py-12 md:grid-cols-2 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-4">
          <p className="text-xl font-bold tracking-tight text-commerce-brand-dark">
            Giacong<span className="font-semibold opacity-80">.vn</span>
          </p>
          <p className="mt-4 max-w-prose leading-relaxed text-commerce-secondary">{COMPANY_BLURB}</p>
        </div>

        <nav aria-labelledby="footer-services" className="lg:col-span-2">
          <FooterColumnHeading id="footer-services">Các dịch vụ chính</FooterColumnHeading>
          <ul>
            {FOOTER_SERVICE_LINKS.map((item) => (
              <li key={item.href}>
                <Link className={linkClass} href={item.href} prefetch={false}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-policies" className="lg:col-span-2">
          <FooterColumnHeading id="footer-policies">Chính sách chung</FooterColumnHeading>
          <ul>
            {FOOTER_POLICY_LINKS.map((item) => (
              <li key={item.href}>
                <Link className={linkClass} href={item.href} prefetch={false}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="lg:col-span-4">
          <FooterColumnHeading>{LEGAL_NAME}</FooterColumnHeading>
          <ul className="space-y-1">
            {COMMERCE_CONTACT_CHANNELS.map((channel) => (
              <li key={channel.href}>
                <a
                  className={linkClass}
                  href={channel.href}
                  {...(channel.isExternal ? { rel: "noopener noreferrer", target: "_blank" } : {})}
                >
                  <span className="font-semibold">{channel.label}:</span>
                  <span className="ml-1.5">{channel.contact}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </CommerceRail>

      <div className="border-t border-[#f1f1f1] py-5 text-center text-[#333]">
        <CommerceRail>
          Bản quyền {new Date().getFullYear()} © <b>Giacong.vn</b>
        </CommerceRail>
      </div>
    </footer>
  );
}
