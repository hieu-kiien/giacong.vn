import { GiacongInteractions } from "@/components/GiacongInteractions";
import { normalizeCapturedMarkup } from "@/lib/captured-markup";
import type { CapturedPageData } from "@/types/captured-page";

type CapturedPageProps = Pick<
  CapturedPageData,
  "markup" | "pageStyles" | "bodyClasses" | "htmlClasses"
>;

export function CapturedPage({
  markup,
  pageStyles,
  bodyClasses,
  htmlClasses,
}: CapturedPageProps) {
  const normalizedMarkup = normalizeCapturedMarkup(markup);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: pageStyles }} />
      <div
        className={bodyClasses}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: normalizedMarkup }}
      />
      <div className="echbay-sms-messenger style-for-position-br" aria-label="Liên hệ nhanh">
        <div className="phonering-alo-alo">
          <a href="tel:0947142999" rel="nofollow" aria-label="Gọi 0947142999">.</a>
        </div>
        <div className="phonering-alo-sms">
          <a href="sms:0947142999" rel="nofollow" aria-label="Nhắn tin 0947142999">.</a>
        </div>
        <div className="phonering-alo-zalo">
          <a
            href="https://zalo.me/0947142999"
            target="_blank"
            rel="nofollow noreferrer"
            aria-label="Liên hệ qua Zalo"
          >
            .
          </a>
        </div>
        <div className="phonering-alo-messenger">
          <a
            href="https://www.facebook.com/giacongvietnam"
            target="_blank"
            rel="nofollow noreferrer"
            aria-label="Liên hệ qua Messenger"
          >
            .
          </a>
        </div>
      </div>
      <GiacongInteractions bodyClasses={bodyClasses} htmlClasses={htmlClasses} />
    </>
  );
}
