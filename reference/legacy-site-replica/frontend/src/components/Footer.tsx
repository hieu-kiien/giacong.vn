'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Script from 'next/script';

export default function Footer() {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowBackToTop(true);
      } else {
        setShowBackToTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToTop = (e: React.MouseEvent) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer id="footer" className="footer-wrapper">
      <section className="section footer-section" id="section_758033202">
        <div className="bg section-bg fill bg-fill bg-loaded"></div>

        <div className="section-content relative">
          <div className="row" id="row-51319729">
            
            {/* Column 1: Logo & Intro */}
            <div id="col-1647429683" className="col medium-4 small-6 large-4">
              <div className="col-inner">
                <div className="icon-box featured-box icon-box-top text-left">
                  <div className="icon-box-img" style={{ maxWidth: '100%', width: '200px' }}>
                    <div className="icon">
                      <div className="icon-inner">
                        <img
                          width="300"
                          height="85"
                          src="/assets/images/logo-gia-cong-new-300x85_f07d085c.png"
                          className="attachment-medium size-medium"
                          alt="Giacong.vn Logo"
                          decoding="async"
                          loading="lazy"
                          sizes="auto, (max-width: 300px) 100vw, 300px"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="icon-box-text last-reset">
                    <p>
                      Giacong.vn cam kết mang đến cho khách hàng những sản phẩm an toàn, đảm bảo vệ sinh và có giá trị dinh dưỡng cao. Không ngừng phát triển và cải tiến, Giacong.vn luôn sẵn sàng hợp tác và gia công theo yêu cầu của các đối tác trong và ngoài nước, đáp ứng đa dạng nhu cầu từ thực phẩm tươi sống đến các sản phẩm chế biến sẵn.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Main Services */}
            <div id="col-491097042" className="col medium-2 small-6 large-2">
              <div className="col-inner">
                <h3>Các dịch vụ chính</h3>
                <ul>
                  <li><Link href="/gia-cong-do-uong">Gia công đồ uống</Link></li>
                  <li><Link href="/gia-cong-duoc-lieu">Gia công dược liệu</Link></li>
                  <li><Link href="/gia-cong-thuc-pham">Gia công thực phẩm</Link></li>
                  <li><Link href="/gia-cong-my-pham">Gia công mỹ phẩm</Link></li>
                  <li><Link href="/gia-cong-sua">Gia công sữa&nbsp;</Link></li>
                  <li><Link href="/dich-vu-say">Gia công sấy&nbsp;</Link></li>
                </ul>
              </div>
            </div>

            {/* Column 3: General Policies */}
            <div id="col-1187272624" className="col medium-2 small-6 large-2">
              <div className="col-inner">
                <h3>Chính sách chung</h3>
                <ul>
                  <li><Link href="/chinh-sach-thanh-toan">Chính sách thanh toán</Link></li>
                  <li><Link href="/chinh-sach-hoan-tien">Chính sách hoàn tiền</Link></li>
                  <li><Link href="/chinh-sach-bao-mat">Chính sách bảo mật</Link></li>
                  <li><Link href="/ban-quyen">Bản quyền phương tiện</Link></li>
                  <li><Link href="/thanh-toan">Thanh toán</Link></li>
                </ul>
              </div>
            </div>

            {/* Column 4: Company Info & Badges */}
            <div id="col-945546302" className="col medium-4 small-6 large-4">
              <div className="col-inner">
                <h3>
                  VIET NAM TRADE PROMOTION <br />
                  DEVELOPMENT INVESTMENT .,JSC
                </h3>
                <ul className="text-info">
                  <li>Hotline: 0947142999</li>
                  <li><i className="fas fa-envelope"></i> Email: info@giacong.vn&nbsp;</li>
                  <li><i className="fas fa-map-marker-alt"></i> <strong>VP Hà Nội:</strong> 109 Trần Hưng Đạo - Hoàn Kiếm - Hà Nội</li>
                  <li><i className="fas fa-map-marker-alt"></i> <strong>Xưởng Sx:&nbsp;</strong>KCN Đồng Văn 3 - Hà Nam</li>
                </ul>
                
                <div className="social-icons follow-icons">
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    target="_blank"
                    data-label="Facebook"
                    rel="noopener noreferrer nofollow"
                    className="icon plain facebook tooltip"
                    title="Follow on Facebook"
                    aria-label="Follow on Facebook"
                  >
                    <i className="icon-facebook"></i>
                  </a>
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    data-label="Instagram"
                    className="icon plain instagram tooltip"
                    title="Follow on Instagram"
                    aria-label="Follow on Instagram"
                  >
                    <i className="icon-instagram"></i>
                  </a>
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    target="_blank"
                    data-label="Twitter"
                    rel="noopener noreferrer nofollow"
                    className="icon plain twitter tooltip"
                    title="Follow on Twitter"
                    aria-label="Follow on Twitter"
                  >
                    <i className="icon-twitter"></i>
                  </a>
                  <a
                    href="mailto:info@giacong.vn"
                    data-label="E-mail"
                    rel="nofollow"
                    className="icon plain email tooltip"
                    title="Send us an email"
                    aria-label="Send us an email"
                  >
                    <i className="icon-envelop"></i>
                  </a>
                </div>

                <br />
                <a
                  href="https://www.dmca.com/Protection/Status.aspx?ID=0dc7288d-82fb-4fbb-bf06-c97df1c0a80d&amp;refurl=https://giacong.vn/"
                  title="DMCA.com Protection Status"
                  className="dmca-badge"
                >
                  <img src="/assets/images/DMCA_badge_grn_60w_6a11eb6b.png" alt="DMCA.com Protection Status" />
                </a>
                
                <Script src="/assets/js/DMCABadgeHelper_min_e18897d0.js" strategy="lazyOnload" />

                <a href="https://www.dmca.com/compliance/giacong.vn" title="DMCA Compliance information for giacong.vn">
                  <img src="/assets/images/dmca-compliant-grayscale_046f1278.png" alt="DMCA compliant image" />
                </a>
              </div>
            </div>

          </div>
        </div>

        <style>{`
          #section_758033202 {
            padding-top: 60px;
            padding-bottom: 60px;
            background-color: rgb(255, 255, 255);
          }
          #section_758033202 .ux-shape-divider--top svg {
            height: 150px;
            --divider-top-width: 100%;
          }
          #section_758033202 .ux-shape-divider--bottom svg {
            height: 150px;
            --divider-width: 100%;
          }
        `}</style>
      </section>

      {/* Absolute Footer */}
      <div className="absolute-footer light medium-text-center text-center">
        <div className="container clearfix">
          <div className="footer-primary pull-left">
            <div className="copyright-footer">
              Copyright 2026 © <b>Giacong.vn</b> | Một sản phẩm thuộc <b>Nethoding</b> | SEO by <b>Netmedia</b>
            </div>
          </div>
        </div>
      </div>

      {/* Back to top button */}
      <a
        href="#top"
        className={`back-to-top button icon invert plain fixed bottom z-1 is-outline hide-for-medium circle ${showBackToTop ? 'active' : ''}`}
        id="top-link"
        aria-label="Go to top"
        onClick={scrollToTop}
        style={{
          opacity: showBackToTop ? 1 : 0,
          visibility: showBackToTop ? 'visible' : 'hidden',
          transition: 'opacity 0.3s, visibility 0.3s',
        }}
      >
        <i className="icon-angle-up"></i>
      </a>
    </footer>
  );
}
