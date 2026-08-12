'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SearchForm from './SearchForm';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const router = useRouter();
  const [isDichVuOpen, setIsDichVuOpen] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const target = e.target as HTMLElement;
      const parent = target.closest('.menu-item-5466');
      if (parent && !target.closest('.sub-menu')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (e.type === 'click') {
          setIsDichVuOpen(prev => !prev);
        }
      }
    };

    document.addEventListener('click', handler, { capture: true });
    document.addEventListener('touchstart', handler, { capture: true });
    document.addEventListener('touchend', handler, { capture: true });
    document.addEventListener('pointerdown', handler, { capture: true });
    document.addEventListener('pointerup', handler, { capture: true });
    return () => {
      document.removeEventListener('click', handler, { capture: true });
      document.removeEventListener('touchstart', handler, { capture: true });
      document.removeEventListener('touchend', handler, { capture: true });
      document.removeEventListener('pointerdown', handler, { capture: true });
      document.removeEventListener('pointerup', handler, { capture: true });
    };
  }, []);

  // Synchronize body and html classes with the open state
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    if (isOpen) {
      html.classList.add('has-off-canvas', 'has-off-canvas-left', 'off-canvas-active');
      body.classList.add('has-off-canvas', 'has-off-canvas-left', 'off-canvas-active');
    } else {
      html.classList.remove('has-off-canvas', 'has-off-canvas-left', 'off-canvas-active');
      body.classList.remove('has-off-canvas', 'has-off-canvas-left', 'off-canvas-active');
    }

    return () => {
      html.classList.remove('has-off-canvas', 'has-off-canvas-left', 'off-canvas-active');
      body.classList.remove('has-off-canvas', 'has-off-canvas-left', 'off-canvas-active');
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsDichVuOpen(false);
    onClose();
  };

  const toggleDichVu = (e: React.MouseEvent) => {
    console.log('toggleDichVu clicked!');
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    setIsDichVuOpen(prev => !prev);
  };

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const href = e.currentTarget.getAttribute('href');
    if (href) {
      router.push(href);
    }
    setTimeout(() => {
      handleClose();
    }, 100);
  };

  return (
    <>
      {/* Overlay to match Flatsome behavior */}
      {isOpen && (
        <div
          className="main-menu-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 99,
            transition: 'opacity 0.3s',
            opacity: 1,
            pointerEvents: 'auto',
          }}
          onClick={handleClose}
        />
      )}

      <div
        id="main-menu"
        className={`mobile-sidebar no-scrollbar ${isOpen ? 'active' : 'mfp-hide'}`}
        style={{ display: isOpen ? 'block' : 'none', zIndex: 100, position: 'fixed' }}
      >
        <div className="sidebar-menu no-scrollbar">
          <ul className="nav nav-sidebar nav-vertical nav-uppercase" data-tab="1">
            <li className="header-search-form search-form html relative has-icon">
              <div className="header-search-form-wrapper">
                <div className="searchform-wrapper ux-search-box relative is-normal">
                  <SearchForm idSuffix="1" />
                </div>
              </div>
            </li>
            <li id="menu-item-5465" className="menu-item menu-item-type-custom menu-item-object-custom current-menu-item current_page_item menu-item-home menu-item-5465 has-icon-left">
              <Link href="/" aria-current="page" onClick={handleLinkClick}>
                <img className="ux-sidebar-menu-icon" width="20" height="20" src="/assets/images/trang-chu-netfood_0bde609d.svg" alt="" />
                Trang Chủ
              </Link>
            </li>
            <li id="menu-item-5496" className="menu-item menu-item-type-post_type menu-item-object-page menu-item-5496 has-icon-left">
              <Link href="/gioi-thieu-ve-gia-cong" onClick={handleLinkClick}>
                <img className="ux-sidebar-menu-icon" width="20" height="20" src="/assets/images/comment-info-150x150_2588cbfe.png" alt="" />
                Về Giacong.vn
              </Link>
            </li>
            <li
              id="menu-item-5466"
              className={`menu-item menu-item-type-custom menu-item-object-custom menu-item-has-children menu-item-5466 has-icon-left has-child ${isDichVuOpen ? 'active' : ''}`}
            >
              <a href="#" onClick={toggleDichVu} aria-expanded={isDichVuOpen ? 'true' : 'false'}>
                <img className="ux-sidebar-menu-icon" width="20" height="20" src="/assets/images/dich-vu_e0dd12ef.svg" alt="" />
                Dịch Vụ Gia Công
              </a>
              <button className="toggle" aria-label="Toggle" aria-expanded={isDichVuOpen ? 'true' : 'false'} onClick={toggleDichVu}>
                <i className="icon-angle-down"></i>
              </button>
              <ul
                className="sub-menu nav-sidebar-ul children"
                style={{ display: isDichVuOpen ? 'block' : 'none' }}
              >
                <li id="menu-item-5467" className="menu-item menu-item-type-taxonomy menu-item-object-category menu-item-5467">
                  <Link href="/gia-cong-sua" onClick={handleLinkClick}>Dịch Vụ Gia Công Sữa</Link>
                </li>
                <li id="menu-item-5468" className="menu-item menu-item-type-taxonomy menu-item-object-category menu-item-5468">
                  <Link href="/dich-vu-say" onClick={handleLinkClick}>Dịch Vụ Sấy</Link>
                </li>
                <li id="menu-item-5469" className="menu-item menu-item-type-taxonomy menu-item-object-category menu-item-5469">
                  <Link href="/bot-gia-vi" onClick={handleLinkClick}>Gia Công Bột Gia Vị</Link>
                </li>
                <li id="menu-item-5470" className="menu-item menu-item-type-taxonomy menu-item-object-category menu-item-5470">
                  <Link href="/gia-cong-ca-phe" onClick={handleLinkClick}>Gia Công Cà Phê</Link>
                </li>
                <li id="menu-item-5471" className="menu-item menu-item-type-taxonomy menu-item-object-category menu-item-5471">
                  <Link href="/gia-cong-duoc-lieu" onClick={handleLinkClick}>Gia Công Dược Liệu</Link>
                </li>
                <li id="menu-item-5472" className="menu-item menu-item-type-taxonomy menu-item-object-category menu-item-5472">
                  <Link href="/gia-cong-do-uong" onClick={handleLinkClick}>Gia Công Đồ Uống</Link>
                </li>
                <li id="menu-item-5473" className="menu-item menu-item-type-taxonomy menu-item-object-category menu-item-5473">
                  <Link href="/gia-cong-my-pham" onClick={handleLinkClick}>Gia Công Mỹ Phẩm</Link>
                </li>
                <li id="menu-item-5474" className="menu-item menu-item-type-taxonomy menu-item-object-category menu-item-5474">
                  <Link href="/gia-cong-thuc-pham" onClick={handleLinkClick}>Gia Công Thực Phẩm</Link>
                </li>
                <li id="menu-item-5475" className="menu-item menu-item-type-taxonomy menu-item-object-category menu-item-5475">
                  <Link href="/gia-cong-tra" onClick={handleLinkClick}>Gia Công Trà</Link>
                </li>
                <li id="menu-item-5476" className="menu-item menu-item-type-taxonomy menu-item-object-category menu-item-5476">
                  <Link href="/thuc-pham-chuc-nang" onClick={handleLinkClick}>Thực Phẩm Chức Năng</Link>
                </li>
              </ul>
            </li>
            <li id="menu-item-5477" className="menu-item menu-item-type-taxonomy menu-item-object-category menu-item-5477 has-icon-left">
              <Link href="/tin-tuc" onClick={handleLinkClick}>
                <img className="ux-sidebar-menu-icon" width="20" height="20" src="/assets/images/gift-card-150x150_491bf688.png" alt="" />
                Tin tức
              </Link>
            </li>
            <li id="menu-item-5478" className="menu-item menu-item-type-post_type menu-item-object-page menu-item-5478 has-icon-left">
              <Link href="/lien-he" onClick={handleLinkClick}>
                <img className="ux-sidebar-menu-icon" width="20" height="20" src="/assets/images/envelope-dot-150x150_6a3bc92e.png" alt="" />
                Liên hệ
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
