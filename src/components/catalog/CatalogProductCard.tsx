import Link from "next/link";

import { CatalogCardPurchase } from "@/components/catalog/CatalogCardPurchase";
import { CatalogProductImage } from "@/components/catalog/CatalogProductImage";
import type { CatalogCardView } from "@/components/catalog/catalog-listing";
import { COMMERCE_TYPOGRAPHY } from "@/components/commerce/typography";
import { formatVnd } from "@/lib/format-vnd";

interface CatalogProductCardProps {
  card: CatalogCardView;
}

/**
 * Product card from `SCR-03-product-card`: image-led, with the category pill
 * inside the image, then name, red price with its unit, specification,
 * availability, a tier-price disclosure and the purchase actions.
 *
 * A server component apart from `CatalogCardPurchase`, which is the single
 * interactive island. `h-full` with the actions pushed down by `mt-auto` inside
 * the island is what keeps every card in a row the same height regardless of how
 * long a product name wraps.
 *
 * The card carries no social-proof or saved-item affordance of any kind, per the
 * card specification and the master plan. Both the image and the name link to
 * detail, and nothing else on the card navigates.
 */
export function CatalogProductCard({ card }: CatalogProductCardProps) {
  const { action, purchase } = card;

  return (
    <article className="commerce-card-surface flex h-full flex-col overflow-hidden" data-catalog-card>
      <div className="relative">
        {/*
          The image links to detail as the specification requires, but takes no tab
          stop: the product name immediately below is the same destination, and two
          adjacent stops to one route is noise for keyboard users. The image alt
          still names the link for assistive technology.
        */}
        <Link
          className="block focus-visible:commerce-focus-ring"
          href={card.detailHref}
          prefetch={false}
          tabIndex={-1}
        >
          <CatalogProductImage
            alt={card.name}
            fallbackSrc={card.fallbackImageUrl}
            imageUrl={card.imageUrl}
            variant="card"
          />
        </Link>
        {card.categoryName ? (
          <span
            className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-commerce-brand-dark"
            data-catalog-category-pill
          >
            {card.categoryName}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h2 className={COMMERCE_TYPOGRAPHY.productTitle}>
          <Link className="hover:text-commerce-brand-dark focus-visible:commerce-focus-ring" href={card.detailHref} prefetch={false}>
            {card.name}
          </Link>
        </h2>

        {/*
          `startingPrice` is a floor by contract — the lowest price across the
          product's usable variants — so it is labelled `Từ`. Rendering it bare
          would read as the price at MOQ, which it is not. The number itself is
          passed through exactly as the feed published it; the card computes no money.
        */}
        <p className="flex flex-wrap items-baseline gap-1.5">
          <span className="text-xs text-commerce-secondary">Từ</span>
          <span className={COMMERCE_TYPOGRAPHY.price}>{formatVnd(card.startingPrice)}</span>
          {card.unitLabel ? <span className="text-xs text-commerce-secondary">/ {card.unitLabel}</span> : null}
        </p>

        <p className="text-xs text-commerce-secondary">{card.specLabel}</p>
        <p className={`text-xs font-semibold ${card.isAvailable ? "text-commerce-brand-dark" : "text-commerce-secondary"}`}>
          {card.availabilityLabel}
        </p>

        {card.tierPrices.length > 1 ? (
          <details className="mt-0.5 text-xs text-commerce-secondary">
            <summary className="cursor-pointer font-semibold text-commerce-brand-dark focus-visible:commerce-focus-ring">
              Giá theo số lượng
            </summary>
            <ul className="mt-1.5 grid gap-0.5">
              {card.tierPrices.map((tier) => (
                <li key={tier.minQuantity}>
                  Từ {tier.minQuantity} {card.unitLabel ?? "đơn vị"}: {formatVnd(tier.price)}
                </li>
              ))}
              {card.contactFromQuantity ? (
                <li>Từ {card.contactFromQuantity} {card.unitLabel ?? "đơn vị"}: liên hệ báo giá</li>
              ) : null}
            </ul>
          </details>
        ) : null}

        {/*
          The specification's last card slot is one action: `Xem chi tiết` when the
          product could be added directly, `Chọn quy cách` when it needs a choice.
          Both lead to the same route, so only one of them is ever rendered.
        */}
        {purchase ? (
          <>
            <CatalogCardPurchase parentSlug={card.slug} productName={card.name} purchase={purchase} />
            <Link
              className="text-center text-xs font-semibold text-commerce-brand-dark underline-offset-4 hover:underline focus-visible:commerce-focus-ring"
              href={card.detailHref}
              prefetch={false}
            >
              Xem chi tiết
            </Link>
          </>
        ) : (
          <div className="mt-auto grid gap-2 pt-3">
            {action.kind === "unavailable" ? (
              <>
                <span className="flex min-h-11 items-center justify-center rounded-commerce-control border border-commerce-border px-4 text-sm font-semibold text-commerce-secondary">
                  {action.label}
                </span>
                <Link
                  className="text-center text-xs font-semibold text-commerce-brand-dark underline-offset-4 hover:underline focus-visible:commerce-focus-ring"
                  href={card.detailHref}
                  prefetch={false}
                >
                  Xem chi tiết
                </Link>
              </>
            ) : (
              <Link
                className="flex min-h-11 items-center justify-center rounded-commerce-control bg-commerce-brand px-4 text-sm font-bold text-white hover:bg-commerce-brand-dark focus-visible:commerce-focus-ring"
                href={card.detailHref}
                prefetch={false}
              >
                {action.label}
              </Link>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
