'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import SearchForm from './SearchForm';
import MobileDrawer from './MobileDrawer';
import SanPhamDropdown from './SanPhamDropdown';
import DichVuDropdown from './DichVuDropdown';

export default function HeaderClient() {
  const [isStuck, setIsStuck] = useState(false);
  const [isTransparent, setIsTransparent] = useState(true);
  const [activeMenu, setActiveMenu] = useState<'product' | 'service' | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const closeTimeout = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeout.current) clearTimeout(closeTimeout.current);
    };
  }, []);

  // Sticky header scroll logic
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 0) {
        setIsStuck(true);
        setIsTransparent(false);
      } else {
        setIsStuck(false);
        setIsTransparent(true);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const openMenu = (menu: 'product' | 'service') => {
    if (closeTimeout.current) clearTimeout(closeTimeout.current);
    setActiveMenu(menu);
  };

  const closeMenuWithDelay = () => {
    if (closeTimeout.current) clearTimeout(closeTimeout.current);
    closeTimeout.current = setTimeout(() => {
      setActiveMenu(null);
    }, 150);
  };

  const handlePointerEnter = (menu: 'product' | 'service') => {
    openMenu(menu);
  };

  const handlePointerLeave = () => {
    closeMenuWithDelay();
  };

  return (
    <>
      <header
        id="header"
        className={`header ${isTransparent ? 'transparent' : ''} has-transparent has-sticky sticky-jump`}
      >
        <div className={`header-wrapper ${isStuck ? 'stuck' : ''}`}>
          <div id="masthead" className="header-main show-logo-center nav-dark">
            <div className="header-inner flex-row container logo-center medium-logo-center" role="navigation">
              
              {/* Logo */}
              <div id="logo" className="flex-col logo">
                <Link href="/" title="Giacong.vn - Công ty chuyên gia công nông sản,thực phẩm,dược phẩm đóng gói hoàn thiện" rel="home">
                  <img
                    width="1020"
                    height="290"
                    src="/assets/images/GIACONG_VN-ngang-03-1-1024x291_b7977d0f.png"
                    className="header_logo header-logo"
                    alt="Giacong.vn"
                  />
                  <img
                    width="1020"
                    height="290"
                    src="/assets/images/GIACONG_VN-ngang-03-1-1024x291_b7977d0f.png"
                    className="header-logo-dark"
                    alt="Giacong.vn"
                  />
                </Link>
              </div>

              {/* Mobile Left Elements */}
              <div className="flex-col show-for-medium flex-left">
                <ul className="mobile-nav nav nav-left">
                  <li className="nav-icon has-icon">
                    <a
                      href="#"
                      className="is-small"
                      aria-label="Menu"
                      aria-controls="main-menu"
                      aria-expanded={isMobileOpen ? 'true' : 'false'}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsMobileOpen(prev => !prev);
                      }}
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onPointerUp={(e) => e.stopPropagation()}
                    >
                      <i className="icon-menu"></i>
                    </a>
                  </li>
                </ul>
              </div>

              {/* Left Elements (Desktop Navigation) */}
              <div className="flex-col hide-for-medium flex-left">
                <ul className="header-nav header-nav-main nav nav-left nav-size-xlarge nav-spacing-large">
                  <li id="menu-item-4618" className="menu-item menu-item-type-custom menu-item-object-custom current-menu-item current_page_item menu-item-home menu-item-4618 active menu-item-design-default has-icon-left">
                    <Link href="/" aria-current="page" className="nav-top-link">
                      <img className="ux-menu-icon" width="20" height="20" src="/assets/images/file-star-svgrepo-com_278476c2.svg" alt="" />
                      Home
                    </Link>
                  </li>
                  <li id="menu-item-5498" className="menu-item menu-item-type-post_type menu-item-object-page menu-item-5498 menu-item-design-default has-icon-left">
                    <Link href="/gioi-thieu-ve-gia-cong" className="nav-top-link">
                      <img className="ux-menu-icon" width="20" height="20" src="/assets/images/file-2-svgrepo-com_0bf082ad.svg" alt="" />
                      Về Giacong.vn
                    </Link>
                  </li>
                  <li
                    id="menu-item-1742"
                    className={`menu-item menu-item-type-post_type menu-item-object-page menu-item-1742 menu-item-design-container-width menu-item-has-block has-dropdown has-icon-left ${activeMenu === 'product' ? 'active hover show' : ''}`}
                    data-menu-active={activeMenu === 'product' ? 'true' : 'false'}
                    onPointerEnter={() => handlePointerEnter('product')}
                    onPointerLeave={handlePointerLeave}
                    onFocus={() => openMenu('product')}
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        closeMenuWithDelay();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setActiveMenu(null);
                      }
                    }}
                  >
                    <Link href="/san-pham" className="nav-top-link" aria-expanded={activeMenu === 'product' ? 'true' : 'false'} aria-haspopup="menu">
                      <img className="ux-menu-icon" width="20" height="20" src="/assets/images/book-open-svgrepo-com_28319749.svg" alt="" />
                      Sản Phẩm
                      <i className="icon-angle-down"></i>
                    </Link>
                    <SanPhamDropdown isActive={activeMenu === 'product'} />
                  </li>
                </ul>
              </div>

              {/* Right Elements (Desktop Navigation continued) */}
              <div className="flex-col hide-for-medium flex-right">
                <ul className="header-nav header-nav-main nav nav-right nav-size-xlarge nav-spacing-large">
                  <li
                    id="menu-item-5166"
                    className={`menu-item menu-item-type-custom menu-item-object-custom menu-item-5166 menu-item-design-container-width menu-item-has-block has-dropdown has-icon-left ${activeMenu === 'service' ? 'active hover show' : ''}`}
                    data-menu-active={activeMenu === 'service' ? 'true' : 'false'}
                    onPointerEnter={() => handlePointerEnter('service')}
                    onPointerLeave={handlePointerLeave}
                    onFocus={() => openMenu('service')}
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        closeMenuWithDelay();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setActiveMenu(null);
                      }
                    }}
                  >
                    <a href="#" className="nav-top-link" aria-expanded={activeMenu === 'service' ? 'true' : 'false'} aria-haspopup="menu" onClick={(e) => e.preventDefault()}>
                      <img className="ux-menu-icon" width="20" height="20" src="/assets/images/bulb-2-svgrepo-com_7bc30e82.svg" alt="" />
                      Dịch vụ
                      <i className="icon-angle-down"></i>
                    </a>
                    <DichVuDropdown isActive={activeMenu === 'service'} />
                  </li>
                  <li id="menu-item-1541" className="menu-item menu-item-type-taxonomy menu-item-object-category menu-item-1541 menu-item-design-default has-icon-left">
                    <Link href="/tin-tuc" className="nav-top-link">
                      <img className="ux-menu-icon" width="20" height="20" src="/assets/images/file-2-svgrepo-com_0bf082ad.svg" alt="" />
                      Tin tức
                    </Link>
                  </li>
                  <li id="menu-item-1542" className="menu-item menu-item-type-post_type menu-item-object-page menu-item-1542 menu-item-design-default has-icon-left">
                    <Link href="/lien-he" className="nav-top-link">
                      <img className="ux-menu-icon" width="20" height="20" src="/assets/images/message-2-star-svgrepo-com_d7019b54.svg" alt="" />
                      Liên hệ
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Search dropdown visible on all viewports */}
              <div className="flex-col flex-right">
                <ul className="mobile-nav nav nav-right">
                  <li className="header-search header-search-dropdown has-icon has-dropdown menu-item-has-children">
                    <a href="#" aria-label="Tìm kiếm" className="is-small" onClick={(e) => e.preventDefault()}>
                      <i className="icon-search"></i>
                    </a>
                    <ul className="nav-dropdown nav-dropdown-default">
                      <li className="header-search-form search-form html relative has-icon">
                        <div className="header-search-form-wrapper">
                          <div className="searchform-wrapper ux-search-box relative is-normal">
                            <SearchForm idSuffix="0" />
                          </div>
                        </div>
                      </li>
                    </ul>
                  </li>
                </ul>
              </div>

            </div>
          </div>
          <div className="header-bg-container fill">
            <div className="header-bg-image fill"></div>
            <div className="header-bg-color fill"></div>
          </div>
        </div>
      </header>
      <MobileDrawer isOpen={isMobileOpen} onClose={() => setIsMobileOpen(false)} />
    </>
  );
}
