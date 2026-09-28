import type { ReactNode } from "react";

import styles from "./NewsArticleBody.module.css";
import { isSafeNewsArticleUrl, parseNewsArticleBlocks } from "@/lib/news-article-content";

export function NewsArticleBody({ content }: { content: string }) {
  const blocks = parseNewsArticleBlocks(content);
  if (blocks.length === 0) return null;

  return (
    <div className={styles.body}>
      {blocks.map((block, index): ReactNode => {
        switch (block.type) {
          case "paragraph": return <p key={index}>{block.text}</p>;
          case "heading": return <h2 key={index}>{block.text}</h2>;
          case "subheading": return <h3 key={index}>{block.text}</h3>;
          case "quote": return <blockquote key={index}>{block.text}</blockquote>;
          case "list": {
            const List = block.ordered ? "ol" : "ul";
            return <List key={index}>{block.items.filter((item) => item.trim()).map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</List>;
          }
          case "image":
            return isSafeNewsArticleUrl(block.url, true) ? (
              <figure className={styles.figure} key={index}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={block.alt} className={styles.image} loading="lazy" src={block.url} />
                {block.caption.trim() ? <figcaption>{block.caption}</figcaption> : null}
              </figure>
            ) : null;
          case "link":
            return isSafeNewsArticleUrl(block.url) ? <p key={index}><a href={block.url}>{block.label}</a></p> : null;
        }
      })}
    </div>
  );
}
