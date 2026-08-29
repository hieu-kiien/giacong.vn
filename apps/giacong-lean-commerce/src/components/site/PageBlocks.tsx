import Link from "next/link";

import { AdminPageContextualAction } from "@/components/admin/AdminPageContextualAction";
import type { PageBlock, PageCta } from "@/lib/page-builder";

export function PageBlocks({ blocks, pageKey }: { blocks: readonly PageBlock[]; pageKey?: string }) {
  if (blocks.length === 0) return null;
  return (
    <main className="managed-page" data-testid="managed-page">
      {pageKey ? <AdminPageContextualAction pageKey={pageKey} /> : null}
      {blocks.map((block, index) => <PageBlockView block={block} key={`${block.type}-${index}`} />)}
    </main>
  );
}

function PageBlockView({ block }: { block: PageBlock }) {
  switch (block.type) {
    case "hero":
      return (
        <section className="managed-block managed-hero">
          <div className="managed-hero-copy">
            {block.eyebrow ? <p className="managed-eyebrow">{block.eyebrow}</p> : null}
            <h1>{block.title}</h1>
            <TextBody value={block.description} />
            <CtaGroup primary={block.primaryCta} secondary={block.secondaryCta} />
          </div>
          {block.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="managed-hero-image" src={block.imageUrl} alt="" />
          ) : null}
        </section>
      );
    case "rich_text":
      return (
        <section className="managed-block managed-rich-text">
          {block.title ? <h2>{block.title}</h2> : null}
          <TextBody value={block.body} />
        </section>
      );
    case "image":
      return (
        <figure className="managed-block managed-image-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.imageUrl} alt={block.alt} />
          {block.caption ? <figcaption>{block.caption}</figcaption> : null}
        </figure>
      );
    case "feature_grid":
      return (
        <section className="managed-block managed-features">
          {block.title ? <h2>{block.title}</h2> : null}
          <div className="managed-feature-grid">
            {block.items.map((item) => (
              <article className="managed-feature-card" key={`${item.title}-${item.description}`}>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>
      );
    case "cta":
      return (
        <section className="managed-block managed-cta">
          <h2>{block.title}</h2>
          {block.body ? <TextBody value={block.body} /> : null}
          <ManagedLink href={block.href} className="managed-button managed-button-primary">{block.label}</ManagedLink>
        </section>
      );
    case "contact":
      return (
        <section className="managed-block managed-contact">
          <h2>{block.title}</h2>
          <TextBody value={block.body} />
        </section>
      );
  }
}

function CtaGroup({ primary, secondary }: { primary: PageCta | null; secondary: PageCta | null }) {
  if (!primary && !secondary) return null;
  return (
    <div className="managed-cta-group">
      {primary ? <ManagedLink href={primary.href} className="managed-button managed-button-primary">{primary.label}</ManagedLink> : null}
      {secondary ? <ManagedLink href={secondary.href} className="managed-button managed-button-secondary">{secondary.label}</ManagedLink> : null}
    </div>
  );
}

function ManagedLink({ children, className, href }: { children: React.ReactNode; className: string; href: string }) {
  const isExternal = /^(?:https?:|mailto:|tel:)/i.test(href);
  return isExternal
    ? <a className={className} href={href}>{children}</a>
    : <Link className={className} href={href}>{children}</Link>;
}

function TextBody({ value }: { value: string }) {
  return (
    <div className="managed-text-body">
      {value.split(/\r?\n/).filter(Boolean).map((paragraph, index) => <p key={`${index}-${paragraph}`}>{paragraph}</p>)}
    </div>
  );
}
