# Analysis Report: Native React Conversion Strategy for Header & Footer

This analysis outlines the strategy to replace the EJS-based global header, footer, and mobile drawer in `giacong.vn` with native, type-safe React (JSX/TSX) components under Next.js. This eliminates all dependencies on disk-reading (`fs.readFileSync`), raw HTML injection (`dangerouslySetInnerHTML`), and runtime string replacements (`cleanLinks`).

---

## 1. Global Header and Footer Analysis

### A. Current Implementation
The current implementation of the header and footer relies on a hybrid static-injection model:
1. **`Header.tsx`**: Reads `src/data/partials/header.ejs` using `fs.readFileSync`, cleans the paths with `cleanLinks()`, and passes the resulting HTML string to `<HeaderClient initialHtml={html} />`.
2. **`HeaderClient.tsx`**: Uses `dangerouslySetInnerHTML` to render the EJS HTML. Once mounted, it executes manual DOM queries (e.g. `querySelector('#menu-item-1742')`) to set up scroll events, desktop hover menus, and mobile drawer toggles.
3. **`Footer.tsx`**: Reads `src/data/partials/footer.ejs` using `fs.readFileSync`, cleans the paths, and immediately renders it via `dangerouslySetInnerHTML`.

### B. EJS Templates
* **`header.ejs`**: Defines the main desktop header navbar (`<header id="header">` and `.header-wrapper`).
  * **Logo Col**: Brand logos (`/assets/images/GIACONG_VN-ngang-03-1-1024x291_b7977d0f.png`).
  * **Mobile Left Col**: Hamburger menu button targeting `#main-menu`.
  * **Left Nav**: Desktop navigation containing links to Home (`/`), Về Giacong.vn (`/gioi-thieu-ve-gia-cong`), and the mega-dropdown for Sản Phẩm (`/san-pham`).
  * **Right Nav**: Desktop navigation containing the mega-dropdown for Dịch vụ (`#`), Tin tức (`/tin-tuc`), and Liên hệ (`/lien-he`).
  * **Mobile Right Col**: Search icon with a dropdown listing the woocommerce-style search form.
* **`footer.ejs`**: Defines the columns containing the logo, description, main services, general policies, contact information, social links, DMCA badges, copyright notice, and back-to-top button.

---

## 2. Mobile Drawer Location, CSS, and Scripts

### A. Mobile Drawer Location
The mobile drawer (`#main-menu` with class `mobile-sidebar`) is **not** defined in `header.ejs` or `footer.ejs`. 
It is defined at the very bottom of **`src/data/pages/home.ejs`** (lines 1780–1829), after the footer include:
```html
<div id="main-menu" class="mobile-sidebar no-scrollbar mfp-hide">
  <div class="sidebar-menu no-scrollbar ">
    <ul class="nav nav-sidebar nav-vertical nav-uppercase" data-tab="1">
      <li class="header-search-form search-form html relative has-icon">...</li>
      <li id="menu-item-5465" class="menu-item ..."><a href="/">Trang Chủ</a></li>
      <li id="menu-item-5496" class="menu-item ..."><a href="/gioi-thieu-ve-gia-cong">Về Giacong.vn</a></li>
      <li id="menu-item-5466" class="menu-item menu-item-has-children ... has-child"><a href="#">Dịch Vụ Gia Công</a>
        <button class="toggle" aria-label="Toggle"><i class="icon-angle-down"></i></button>
        <ul class="sub-menu nav-sidebar-ul children">
          <li id="menu-item-5467" ...><a href="/gia-cong-sua">Dịch Vụ Gia Công Sữa</a></li>
          ...
        </ul>
      </li>
      ...
    </ul>
  </div>
</div>
```
When `pageParser.ts` executes `getLayoutShell()`, it reads `home.ejs` and splits it by `<%- include('../partials/footer') %>`. Everything after that include is stored in the `afterFooter` property. This string is then injected into the layout or pages (like `app/page.tsx` and `app/[...slug]/page.tsx`) as `dangerouslySetInnerHTML={{ __html: data.afterFooter }}`.

### B. Relevant CSS Stylesheets
The visual styles for the header sticky states, mega-menus, and mobile drawer are imported in `app/layout.tsx`:
* **`/assets/css/flatsome_1a697c57.css`**: Defines layout, grid, responsive utility classes (`show-for-medium`, `hide-for-medium`), mobile navigation overlays (`main-menu-overlay`), and sidebar transitions.
* **`/assets/css/style_a70a3410.css`**: Defines custom colors, fonts, margins, padding, and specific custom widgets for `giacong.vn`.
* **`/assets/css/styles_a86a383a.css`**: Contact Form 7 support styles.

### C. Relevant Scripts
* **`/assets/js/flatsome_7896dbf8.js`**: Controls jQuery-based mobile off-canvas activation and desktop menu hover effects.
* **`frontend/src/components/HeaderClient.tsx`**: Contains custom React hooks which capture events and manually manipulate class lists in the DOM to replicate the Flatsome theme's native behaviors under Next.js.

---

## 3. Proposed Native Component Architecture

We will eliminate all disk reads and HTML injection by creating native React components. To make implementation straightforward and preserve Flatsome's global class styling, we will replicate the exact DOM structures and classes inside JSX.

### A. Sub-Components
1. **`SearchForm`**: Renders the search search bar natively.
2. **`HeaderLogo`**: Renders the desktop/mobile logos with correct class structures.
3. **`SanPhamDropdown`**: Renders the desktop "Sản Phẩm" mega-dropdown list natively.
4. **`DichVuDropdown`**: Renders the desktop "Dịch vụ" mega-dropdown list natively.
5. **`MobileDrawer`**: Renders the slide-out menu drawer and nested submenus.
6. **`Footer`**: Renders the static columns and absolute footer.

---

## 4. Precise JSX Structures

### A. Header.tsx & HeaderClient.tsx
`HeaderClient.tsx` will house the header wrapper and handle the dynamic UI state:

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SearchForm from './SearchForm';
import MobileDrawer from './MobileDrawer';

export default function HeaderClient() {
  const pathname = usePathname();
  const [isStuck, setIsStuck] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<'product' | 'service' | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const closeTimeout = useRef<NodeJS.Timeout | null>(null);

  // Scroll listener for sticky header class
  useEffect(() => {
    const handleScroll = () => {
      setIsStuck(window.scrollY > 0);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Sync mobile drawer open state with body/html classes (to match Flatsome behavior)
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    if (isMobileOpen) {
      html.classList.add('has-off-canvas', 'has-off-canvas-left', 'off-canvas-active');
      body.classList.add('has-off-canvas', 'has-off-canvas-left', 'off-canvas-active');
    } else {
      html.classList.remove('has-off-canvas', 'has-off-canvas-left', 'off-canvas-active');
      body.classList.remove('has-off-canvas', 'has-off-canvas-left', 'off-canvas-active');
    }
  }, [isMobileOpen]);

  const handleMouseEnter = (menu: 'product' | 'service') => {
    if (closeTimeout.current) clearTimeout(closeTimeout.current);
    setActiveDropdown(menu);
  };

  const handleMouseLeave = () => {
    closeTimeout.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 150);
  };

  return (
    <>
      <header
        id="header"
        className={`header transparent has-transparent has-sticky sticky-jump ${
          isStuck ? '' : 'transparent'
        }`}
      >
        <div className={`header-wrapper ${isStuck ? 'stuck' : ''}`}>
          <div id="masthead" className="header-main show-logo-center nav-dark">
            <div className="header-inner flex-row container logo-center medium-logo-center" role="navigation">
              
              {/* Logo */}
              <div id="logo" className="flex-col logo">
                <Link href="/" title="Giacong.vn" rel="home">
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

              {/* Mobile Left Toggle */}
              <div className="flex-col show-for-medium flex-left">
                <ul className="mobile-nav nav nav-left">
                  <li className="nav-icon has-icon">
                    <a
                      href="#"
                      className="is-small"
                      aria-label="Menu"
                      onClick={(e) => {
                        e.preventDefault();
                        setIsMobileOpen(true);
                      }}
                    >
                      <i className="icon-menu"></i>
                    </a>
                  </li>
                </ul>
              </div>

              {/* Desktop Left Elements */}
              <div className="flex-col hide-for-medium flex-left">
                <ul className="header-nav header-nav-main nav nav-left nav-size-xlarge nav-spacing-large">
                  <li
                    className={`menu-item has-icon-left ${
                      pathname === '/' ? 'current-menu-item current_page_item active' : ''
                    }`}
                  >
                    <Link href="/" className="nav-top-link">
                      <img
                        className="ux-menu-icon"
                        width="20"
                        height="20"
                        src="/assets/images/file-star-svgrepo-com_278476c2.svg"
                        alt=""
                      />
                      Home
                    </Link>
                  </li>
                  <li
                    className={`menu-item has-icon-left ${
                      pathname === '/gioi-thieu-ve-gia-cong' ? 'current-menu-item active' : ''
                    }`}
                  >
                    <Link href="/gioi-thieu-ve-gia-cong" className="nav-top-link">
                      <img
                        className="ux-menu-icon"
                        width="20"
                        height="20"
                        src="/assets/images/file-2-svgrepo-com_0bf082ad.svg"
                        alt=""
                      />
                      Về Giacong.vn
                    </Link>
                  </li>
                  <li
                    className={`menu-item menu-item-design-container-width menu-item-has-block has-dropdown has-icon-left ${
                      activeDropdown === 'product' ? 'active hover show' : ''
                    }`}
                    onMouseEnter={() => handleMouseEnter('product')}
                    onMouseLeave={handleMouseLeave}
                  >
                    <Link href="/san-pham" className="nav-top-link">
                      <img
                        className="ux-menu-icon"
                        width="20"
                        height="20"
                        src="/assets/images/book-open-svgrepo-com_28319749.svg"
                        alt=""
                      />
                      Sản Phẩm
                      <i className="icon-angle-down"></i>
                    </Link>
                    <SanPhamDropdown isOpen={activeDropdown === 'product'} />
                  </li>
                </ul>
              </div>

              {/* Desktop Right Elements */}
              <div className="flex-col hide-for-medium flex-right">
                <ul className="header-nav header-nav-main nav nav-right nav-size-xlarge nav-spacing-large">
                  <li
                    className={`menu-item menu-item-design-container-width menu-item-has-block has-dropdown has-icon-left ${
                      activeDropdown === 'service' ? 'active hover show' : ''
                    }`}
                    onMouseEnter={() => handleMouseEnter('service')}
                    onMouseLeave={handleMouseLeave}
                  >
                    <Link href="#" className="nav-top-link">
                      <img
                        className="ux-menu-icon"
                        width="20"
                        height="20"
                        src="/assets/images/bulb-2-svgrepo-com_7bc30e82.svg"
                        alt=""
                      />
                      Dịch vụ
                      <i className="icon-angle-down"></i>
                    </Link>
                    <DichVuDropdown isOpen={activeDropdown === 'service'} />
                  </li>
                  <li
                    className={`menu-item has-icon-left ${
                      pathname === '/tin-tuc' ? 'current-menu-item active' : ''
                    }`}
                  >
                    <Link href="/tin-tuc" className="nav-top-link">
                      <img
                        className="ux-menu-icon"
                        width="20"
                        height="20"
                        src="/assets/images/file-2-svgrepo-com_0bf082ad.svg"
                        alt=""
                      />
                      Tin tức
                    </Link>
                  </li>
                  <li
                    className={`menu-item has-icon-left ${
                      pathname === '/lien-he' ? 'current-menu-item active' : ''
                    }`}
                  >
                    <Link href="/lien-he" className="nav-top-link">
                      <img
                        className="ux-menu-icon"
                        width="20"
                        height="20"
                        src="/assets/images/message-2-star-svgrepo-com_d7019b54.svg"
                        alt=""
                      />
                      Liên hệ
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Mobile Right Search Dropdown */}
              <div className="flex-col show-for-medium flex-right">
                <ul className="mobile-nav nav nav-right">
                  <li className="header-search header-search-dropdown has-icon has-dropdown menu-item-has-children">
                    <a href="#" aria-label="Tìm kiếm" className="is-small">
                      <i className="icon-search"></i>
                    </a>
                    <ul className="nav-dropdown nav-dropdown-default">
                      <li className="header-search-form search-form html relative has-icon">
                        <div className="header-search-form-wrapper">
                          <SearchForm idSuffix="mobile-nav" />
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

      {/* Mobile Drawer */}
      <MobileDrawer isOpen={isMobileOpen} onClose={() => setIsMobileOpen(false)} />
    </>
  );
}
```

### B. Mega-Dropdown Components (e.g. SanPhamDropdown.tsx)
Instead of static HTML strings, dropdown components render JSX lists:

```tsx
export default function SanPhamDropdown({ isOpen }: { isOpen: boolean }) {
  return (
    <div
      className={`sub-menu nav-dropdown ${isOpen ? 'nav-dropdown-active show' : ''}`}
      style={{
        display: isOpen ? 'block' : 'none',
        opacity: isOpen ? 1 : 0,
        visibility: isOpen ? 'visible' : 'hidden',
      }}
    >
      <div className="row row-small menu-san-pham" id="row-1490213718">
        <div className="col medium-3 small-6 large-3">
          <div className="col-inner">
            <h4><Link href="/gia-cong-sot-cham">Gia công sốt chấm</Link></h4>
            <h4><Link href="/gia-cong-do-uong">Gia công đồ uống</Link></h4>
            <h4><Link href="/gia-cong-bot-pha-che">Gia công bột pha chế</Link></h4>
            {/* ... other items ... */}
          </div>
        </div>
        <div className="col medium-3 small-6 large-3">
          <div className="col-inner">
            <h4><Link href="/gia-cong-sua">Gia công sữa</Link></h4>
            <div className="ux-menu stack stack-col justify-start ux-menu--divider-solid">
              <div className="ux-menu-link flex menu-item">
                <Link href="/gia-cong-sua-bot" className="ux-menu-link__link flex">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Gia công sữa bột</span>
                </Link>
              </div>
            </div>
            {/* ... other categories like sấy and nước trái cây ... */}
          </div>
        </div>
        {/* ... remaining cols ... */}
      </div>
    </div>
  );
}
```

### C. MobileDrawer.tsx
This manages the slide-out menu drawer, background overlay, and internal accordion submenus natively:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import SearchForm from './SearchForm';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});

  const toggleSubmenu = (menuKey: string) => {
    setOpenSubmenus((prev) => ({
      ...prev,
      [menuKey]: !prev[menuKey],
    }));
  };

  return (
    <>
      {/* Off-canvas background overlay */}
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
          }}
          onClick={onClose}
        />
      )}

      <div
        id="main-menu"
        className={`mobile-sidebar no-scrollbar ${isOpen ? 'active' : 'mfp-hide'}`}
        style={{
          display: isOpen ? 'block' : 'none',
        }}
      >
        <div className="sidebar-menu no-scrollbar">
          <ul className="nav nav-sidebar nav-vertical nav-uppercase">
            
            {/* Search form in sidebar */}
            <li className="header-search-form search-form html relative has-icon">
              <div className="header-search-form-wrapper">
                <SearchForm idSuffix="sidebar" />
              </div>
            </li>

            {/* Navigation links */}
            <li className="menu-item has-icon-left">
              <Link href="/" onClick={onClose}>
                <img
                  className="ux-sidebar-menu-icon"
                  width="20"
                  height="20"
                  src="/assets/images/trang-chu-netfood_0bde609d.svg"
                  alt="Trang Chủ"
                />
                Trang Chủ
              </Link>
            </li>
            
            <li className="menu-item has-icon-left">
              <Link href="/gioi-thieu-ve-gia-cong" onClick={onClose}>
                <img
                  className="ux-sidebar-menu-icon"
                  width="20"
                  height="20"
                  src="/assets/images/comment-info-150x150_2588cbfe.png"
                  alt="Về Giacong.vn"
                />
                Về Giacong.vn
              </Link>
            </li>

            {/* Submenu Item */}
            <li
              className={`menu-item menu-item-has-children has-icon-left has-child ${
                openSubmenus['dichvu'] ? 'active' : ''
              }`}
            >
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  toggleSubmenu('dichvu');
                }}
              >
                <img
                  className="ux-sidebar-menu-icon"
                  width="20"
                  height="20"
                  src="/assets/images/dich-vu_e0dd12ef.svg"
                  alt="Dịch Vụ Gia Công"
                />
                Dịch Vụ Gia Công
              </a>
              <button
                className="toggle"
                aria-label="Toggle"
                aria-expanded={openSubmenus['dichvu'] ? 'true' : 'false'}
                onClick={() => toggleSubmenu('dichvu')}
              >
                <i className="icon-angle-down"></i>
              </button>
              <ul
                className="sub-menu nav-sidebar-ul children"
                style={{
                  display: openSubmenus['dichvu'] ? 'block' : 'none',
                }}
              >
                <li><Link href="/gia-cong-sua" onClick={onClose}>Dịch Vụ Gia Công Sữa</Link></li>
                <li><Link href="/dich-vu-say" onClick={onClose}>Dịch Vụ Sấy</Link></li>
                <li><Link href="/bot-gia-vi" onClick={onClose}>Gia Công Bột Gia Vị</Link></li>
                <li><Link href="/gia-cong-ca-phe" onClick={onClose}>Gia Công Cà Phê</Link></li>
                {/* Other sub-menu links */}
              </ul>
            </li>

            <li className="menu-item has-icon-left">
              <Link href="/tin-tuc" onClick={onClose}>
                <img
                  className="ux-sidebar-menu-icon"
                  width="20"
                  height="20"
                  src="/assets/images/gift-card-150x150_491bf688.png"
                  alt="Tin tức"
                />
                Tin tức
              </Link>
            </li>

            <li className="menu-item has-icon-left">
              <Link href="/lien-he" onClick={onClose}>
                <img
                  className="ux-sidebar-menu-icon"
                  width="20"
                  height="20"
                  src="/assets/images/envelope-dot-150x150_6a3bc92e.png"
                  alt="Liên hệ"
                />
                Liên hệ
              </Link>
            </li>

          </ul>
        </div>
      </div>
    </>
  );
}
```

### D. Footer.tsx
We convert `footer.ejs` to a native React component. Back-to-top dynamic scroll logic will be included natively:

```tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Footer() {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', toggleVisibility, { passive: true });
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = (e: React.MouseEvent) => {
    e.preventDefault();
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <footer id="footer" className="footer-wrapper">
      <section className="section footer-section" id="section_758033202">
        <div className="bg section-bg fill bg-fill bg-loaded"></div>
        <div className="section-content relative">
          <div className="row" id="row-51319729">
            
            {/* Info Column */}
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
                          alt=""
                        />
                      </div>
                    </div>
                  </div>
                  <div className="icon-box-text last-reset">
                    <p>
                      Giacong.vn cam kết mang đến cho khách hàng những sản phẩm an toàn...
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Services Column */}
            <div id="col-491097042" className="col medium-2 small-6 large-2">
              <div className="col-inner">
                <h3>Các dịch vụ chính</h3>
                <ul>
                  <li><Link href="/gia-cong-do-uong">Gia công đồ uống</Link></li>
                  <li><Link href="/gia-cong-duoc-lieu">Gia công dược liệu</Link></li>
                  {/* ... other footer links ... */}
                </ul>
              </div>
            </div>

            {/* Policies Column */}
            <div id="col-1187272624" className="col medium-2 small-6 large-2">
              <div className="col-inner">
                <h3>Chính sách chung</h3>
                <ul>
                  <li><Link href="/chinh-sach-thanh-toan">Chính sách thanh toán</Link></li>
                  {/* ... other footer links ... */}
                </ul>
              </div>
            </div>

            {/* Contact Column */}
            <div id="col-945546302" className="col medium-4 small-6 large-4">
              <div className="col-inner">
                <h3>VIET NAM TRADE PROMOTION <br />DEVELOPMENT INVESTMENT .,JSC</h3>
                <ul className="text-info">
                  <li>Hotline : 0947142999</li>
                  <li>Email: info@giacong.vn</li>
                  {/* ... other contact info ... */}
                </ul>
              </div>
            </div>

          </div>
        </div>
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
        className={`back-to-top button icon invert plain fixed bottom z-1 is-outline hide-for-medium circle ${
          showScrollTop ? 'active' : ''
        }`}
        style={{
          visibility: showScrollTop ? 'visible' : 'hidden',
          opacity: showScrollTop ? 1 : 0,
          transition: 'opacity 0.3s, visibility 0.3s',
        }}
        onClick={scrollToTop}
        aria-label="Go to top"
      >
        <i className="icon-angle-up"></i>
      </a>
    </footer>
  );
}
```

---

## 5. React Hooks and Dynamic Logic Summary

| Feature | State/Hook | Mechanism |
| :--- | :--- | :--- |
| **Sticky Header** | `isStuck` (boolean) + `useEffect` | Attaches a listener on `window.scrollY`. Adds the `stuck` class when scroll position is greater than 0. |
| **Desktop Dropdowns** | `activeDropdown` (string) + `useRef` (close timeout) | Sets active menu key on `onMouseEnter`. Uses `setTimeout` on `onMouseLeave` to create a delay buffer, preventing immediate close on accidental pointer exits. |
| **Mobile Drawer Open/Close** | `isMobileOpen` (boolean) + `useEffect` | Toggles rendering of overlay and sets the classes `has-off-canvas`, `has-off-canvas-left`, `off-canvas-active` on the `<html>` and `<body>` tags. |
| **Mobile Sidebar Submenu Accordions** | `openSubmenus` (Record object) | Tracks toggle state per submenu item. Allows collapsing/expanding each item individually. |
| **Active Nav Link Styling** | `usePathname` (Next.js Hook) | Compares the active route (`pathname`) to link paths, applying `current-menu-item` or `active` classes automatically. |
| **Back to Top Button** | `showScrollTop` (boolean) + `useEffect` | Shows the button when scrolled down by 300px. Uses `window.scrollTo` with smooth scroll behavior on click. |

---

## 6. Codebase-wide Audit: dangerouslySetInnerHTML & fs.readFileSync

An exhaustive search of the `frontend/src` directory returned the following occurrences:

### A. All `dangerouslySetInnerHTML` occurrences
1. **Header/Footer Components**:
   - `frontend/src/components/HeaderClient.tsx:350` (renders raw EJS header markup)
   - `frontend/src/components/Footer.tsx:14` (renders raw EJS footer markup)
2. **Page Templates** (used to render custom parsed EJS content):
   - `frontend/src/app/page.tsx:27` (`beforeHeader`)
   - `frontend/src/app/page.tsx:32` (`content`)
   - `frontend/src/app/page.tsx:37` (`afterFooter`)
   - `frontend/src/app/[...slug]/page.tsx:38` (`beforeHeader`)
   - `frontend/src/app/[...slug]/page.tsx:43` (`content`)
   - `frontend/src/app/[...slug]/page.tsx:48` (`afterFooter`)
   - `frontend/src/app/search/page.tsx:129` (`beforeHeader`)
   - `frontend/src/app/search/page.tsx:237` (`afterFooter`)
   - `frontend/src/app/tin-tuc/page.tsx:87` (`beforeHeader`)
   - `frontend/src/app/tin-tuc/page.tsx:196` (`afterFooter`)
   - `frontend/src/app/not-found.tsx:53` (`beforeHeader`)
   - `frontend/src/app/not-found.tsx:58` (`content`)
   - `frontend/src/app/not-found.tsx:63` (`afterFooter`)
3. **Global Layout Configuration**:
   - `frontend/src/app/layout.tsx:33` (WordPress presets style injection)
   - `frontend/src/app/layout.tsx:38` (Flatsome icons custom `@font-face` injection)
   - `frontend/src/app/layout.tsx:61` (JS-detection class addition on `<html>`)
   - `frontend/src/app/layout.tsx:62` (Flatsome themes configuration variables injection)
   - `frontend/src/app/layout.tsx:150` (Contact Form 7 support initialization)

### B. All `fs.readFileSync` / `readFile` occurrences
1. **Header/Footer Components**:
   - `frontend/src/components/Header.tsx:11` (`fs.readFileSync` on `header.ejs`)
   - `frontend/src/components/Footer.tsx:10` (`fs.readFileSync` on `footer.ejs`)
2. **Page Templates & Search Handler**:
   - `frontend/src/app/search/page.tsx:45` (`fs.readFileSync` on `products.json`)
   - `frontend/src/app/search/page.tsx:54` (`fs.readFileSync` on `services.json`)
3. **Data Parsers**:
   - `frontend/src/utils/pageParser.ts:129` (`fs.promises.readFile` on `home.ejs` to parse page layout templates)
   - `frontend/src/utils/pageParser.ts:222` (`fs.promises.readFile` on slug-specific EJS page mockups)
   - `frontend/src/utils/pageParser.ts:277` (`fs.promises.readFile` on `metadata.json` to load SEO metadata tags)

*Note: Replacing `Header.tsx` and `Footer.tsx` with native components will directly eliminate the `fs.readFileSync` references in those two files, and will allow removing the `afterFooter` and `beforeHeader` HTML injection in the page files once layout shells are fully migrated.*
