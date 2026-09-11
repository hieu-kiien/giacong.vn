import Link from "next/link";

import { CatalogProductImage } from "@/components/catalog/CatalogProductImage";
import type { CatalogCardView } from "@/components/catalog/catalog-listing";
import { COMMERCE_TYPOGRAPHY } from "@/components/commerce/typography";
import { formatVnd } from "@/lib/format-vnd";

interface CatalogProductCardProps {
  card: CatalogCardView;
}

/**
 * Compact product card for the catalog grid. Every product uses the same detail
 * action; variant selection and request-cart actions live on product detail.
 * `h-full` and `mt-auto` keep the action aligned across each responsive grid row.
 */
export function CatalogProductCard({ card }: CatalogProductCardProps) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[10px] border border-commerce-border bg-white text-left transition-colors hover:border-commerce-brand" data-catalog-card>
      <div className="relative">
        {/*
          The image links to detail as the specification requires, but takes no tab
          stop: the product name immediately below is the same destination, and two
          adjacent stops to one route is noise for keyboard users. The image alt
          still names the link for assistive technology.
        */}
        <Link
          className="block overflow-hidden focus-visible:commerce-focus-ring"
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
            className="absolute left-2 top-2 rounded-full border border-commerce-brand/40 bg-commerce-active-surface px-2 py-0.5 text-[9px] font-semibold leading-3 text-commerce-brand-dark"
            data-catalog-category-pill
          >
            {card.categoryName}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col items-start gap-1 px-2.5 py-2">
        <h2 className={`${COMMERCE_TYPOGRAPHY.productTitle} !mb-0 line-clamp-2 w-full !text-[12px] !leading-4 !text-commerce-body`}>
          <Link className="!text-commerce-body hover:text-commerce-brand-dark focus-visible:commerce-focus-ring" href={card.detailHref} prefetch={false}>
            {card.name}
          </Link>
        </h2>

        {/*
          `startingPrice` is a floor by contract — the lowest price across the
          product's usable variants — so it is labelled `Từ`. Rendering it bare
          would read as the price at MOQ, which it is not. The number itself is
          passed through exactly as the feed published it; the card computes no money.
        */}
        {/*
          The `{" "}` separators are text, not decoration. Without them the three spans
          concatenate to `Từ720.000 ₫/ bao` in the accessible name and in any text
          extraction, because the visible spacing comes from the flex gap rather than
          from the content. A whitespace-only text node between flex items is not
          rendered, so these restore the reading without changing the layout.
        */}
        <p className="!mb-0 text-[10px] !leading-4 text-commerce-secondary" data-catalog-spec>
          {card.specLabel}
        </p>

        {card.shortDescription ? (
          <p className="!mb-0 line-clamp-2 text-[10.5px] !leading-4 text-commerce-secondary" data-catalog-description>
            {card.shortDescription}
          </p>
        ) : null}

        <p className="!mb-0 text-[10px] !leading-4 text-commerce-secondary" data-catalog-identifiers>
          {card.sku ? <span>SKU: {card.sku}</span> : null}
          {card.minimumOrderQuantity ? <span>{card.sku ? " · " : ""}MOQ {card.minimumOrderQuantity}</span> : null}
        </p>

        <p className="!mb-0 flex flex-wrap items-baseline justify-start gap-0.5 !leading-4" data-catalog-price>
          {card.startingPrice === null ? (
            <span className={`${COMMERCE_TYPOGRAPHY.price} !text-[15px] !leading-4`}>Liên hệ</span>
          ) : <>
            <span className="text-[10px] text-commerce-secondary">Từ</span>{" "}
            <span className={`${COMMERCE_TYPOGRAPHY.price} !text-[15px] !leading-4`}>{formatVnd(card.startingPrice)}</span>
            {card.unitLabel ? <>{" "}<span className="text-[10px] text-commerce-secondary">/ {card.unitLabel}</span></> : null}
          </>}
        </p>

        <p
          className={`!mb-0 text-[10px] !leading-4 font-semibold ${card.isAvailable ? "text-commerce-brand-dark" : "text-commerce-secondary"}`}
          data-catalog-stock
        >
          {card.isAvailable ? <span aria-hidden className="mr-1 inline-block size-1.5 rounded-full bg-commerce-brand" /> : null}
          {card.isAvailable ? "Còn hàng" : card.availabilityLabel}
        </p>

        <div className="mt-auto w-full pt-2" data-catalog-action-tray>
          <Link
            aria-label={`Xem chi tiết ${card.name}`}
            className="flex min-h-11 w-full items-center justify-center rounded-commerce-control bg-commerce-brand-dark px-3 text-[13px] font-bold text-white transition-colors hover:brightness-90 focus-visible:commerce-focus-ring min-[520px]:min-h-8 min-[520px]:text-[11px]"
            data-catalog-detail-action
            href={card.detailHref}
            prefetch={false}
          >
            Xem chi tiết
          </Link>
        </div>

      </div>
    </article>
  );
}
