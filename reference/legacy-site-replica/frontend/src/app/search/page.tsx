import React from 'react';
import fs from 'fs';
import path from 'path';
import { getPageData, cleanLinks } from '@/utils/pageParser';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ClientPage, { SafeHTML } from '@/components/ClientPage';
import type { Metadata } from 'next';

interface SearchPageProps {
  searchParams: Promise<{
    s?: string;
  }>;
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { s } = await searchParams;
  const query = s || '';
  return {
    title: `Kết quả tìm kiếm cho "${query}" - Giacong.vn`,
    description: `Kết quả tìm kiếm cho từ khóa "${query}" tại Giacong.vn.`,
  };
}

// Helper function to remove Vietnamese accents/tones for robust search matching
function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

// Fallback search logic using static JSON data
function performLocalSearch(query: string) {
  if (!query) return [];
  const normalizedQuery = removeVietnameseTones(query.toLowerCase().trim());
  
  let products: any[] = [];
  let services: any[] = [];
  
  try {
    let productsPath = path.join(process.cwd(), 'src/data/products.json');
    if (!fs.existsSync(productsPath)) {
      productsPath = path.join(process.cwd(), 'frontend/src/data/products.json');
    }
    if (fs.existsSync(productsPath)) {
      products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading products.json in search fallback:', err);
  }
  
  try {
    let servicesPath = path.join(process.cwd(), 'src/data/services.json');
    if (!fs.existsSync(servicesPath)) {
      servicesPath = path.join(process.cwd(), 'frontend/src/data/services.json');
    }
    if (fs.existsSync(servicesPath)) {
      services = JSON.parse(fs.readFileSync(servicesPath, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading services.json in search fallback:', err);
  }

  function cleanUrl(url: string) {
    if (!url) return '#';
    let pathStr = url.replace(/^https?:\/\/(www\.)?giacong\.vn/i, '');
    if (pathStr.startsWith('/') && pathStr.endsWith('/') && pathStr !== '/') {
      pathStr = pathStr.slice(0, -1);
    }
    return pathStr || '/';
  }

  const matchedProducts = products
    .filter(p => p.name && removeVietnameseTones(p.name.toLowerCase()).includes(normalizedQuery))
    .map(p => ({
      type: 'product',
      name: p.name,
      image: p.image,
      price: p.price || 'Liên hệ',
      href: cleanUrl(p.href)
    }));

  const matchedServices = services
    .filter(s => s.text && removeVietnameseTones(s.text.toLowerCase()).includes(normalizedQuery))
    .map(s => ({
      type: 'service',
      name: s.text,
      image: null,
      price: 'Liên hệ',
      href: cleanUrl(s.href)
    }));

  return [...matchedProducts, ...matchedServices];
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { s } = await searchParams;
  const query = s || '';
  
  let results: any[] = [];
  let apiUsed = false;
  
  // Try fetching from the Laravel API
  if (query) {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8002';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(`${backendUrl}/api/search?s=${encodeURIComponent(query)}`, {
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        results = await response.json();
        apiUsed = true;
      }
    } catch (err) {
      console.warn('Laravel API search offline or timed out. Falling back to local search.', err);
    }
    
    // Fallback to local search if API failed or was offline
    if (!apiUsed) {
      results = performLocalSearch(query);
    }
  }

  // Load EJS structures to keep the wrapper and custom scripts
  const pageData = await getPageData('search');
  const beforeHeader = pageData?.beforeHeader || '';
  const afterFooter = pageData?.afterFooter || '';
  const bodyClass = pageData?.bodyClass || 'archive post-type-archive post-type-archive-product wp-theme-flatsome wp-child-theme-thiet-ke-web theme-flatsome woocommerce-shop woocommerce woocommerce-page woocommerce-js lightbox nav-dropdown-has-shadow nav-dropdown-has-border';

  return (
    <div id="original-content">
      {/* Before Header Content */}
      <SafeHTML html={beforeHeader} />
      
      <Header />
      
      {/* Search Content Layout matching EJS layout */}
      <div className="shop-page-title category-page-title page-title ">
        <div className="page-title-inner flex-row  medium-flex-wrap container">
          <div className="flex-col flex-grow medium-text-center">
            <h1 className="shop-page-title is-xlarge">Kết Quả Tìm Kiếm Cho: "{query}"</h1>
            <div className="is-small">
              <nav className="woocommerce-breadcrumb breadcrumbs uppercase">
                <a href="/">Trang chủ</a> <span className="divider">/</span> Tìm kiếm
              </nav>
            </div>
          </div>
          <div className="flex-col medium-text-center">
            <p className="woocommerce-result-count" aria-hidden="false">
              Tìm thấy {results.length} kết quả
            </p>
            <form className="woocommerce-ordering" method="get">
              <select name="orderby" className="orderby" aria-label="Đơn hàng của cửa hàng" defaultValue="menu_order">
                <option value="menu_order">Sắp xếp mặc định</option>
                <option value="popularity">Sắp xếp theo mức độ phổ biến</option>
                <option value="rating">Sắp xếp theo xếp hạng trung bình</option>
                <option value="date">Sắp xếp theo mới nhất</option>
                <option value="price">Sắp xếp theo giá: thấp đến cao</option>
                <option value="price-desc">Sắp xếp theo giá: cao đến thấp</option>
              </select>
              <input type="hidden" name="paged" value="1" style={{ display: 'none' }} />
            </form>
          </div>
        </div>
      </div>

      <main id="main" className="">
        <div className="row category-page-row">
          <div className="col large-12">
            <div className="shop-container">
              <div className="woocommerce-notices-wrapper"></div>
              
              <div className="products row row-small large-columns-6 medium-columns-4 small-columns-2 has-equal-box-heights equalize-box">
                {results.length > 0 ? (
                  results.map((item, idx) => (
                    <div key={idx} className="product-small col has-hover product type-product status-publish instock has-post-thumbnail shipping-taxable product-type-simple">
                      <div className="col-inner">
                        <div className="product-small box ">
                          <div className="box-image">
                            <div className="image-fade_in_back">
                              <a href={item.href} aria-label={item.name}>
                                {item.image ? (
                                  <img width="247" height="296" src={item.image} className="attachment-woocommerce_thumbnail size-woocommerce_thumbnail" alt={item.name} decoding="async" />
                                ) : (
                                  <div style={{ width: '247px', height: '296px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
                                    <span style={{ fontSize: '14px', color: '#666', fontWeight: 'bold', textAlign: 'center', padding: '10px' }}>
                                      {item.type === 'service' ? 'Dịch vụ' : 'Sản phẩm'}
                                    </span>
                                  </div>
                                )}
                              </a>
                            </div>
                          </div>
                          
                          <div className="box-text box-text-products text-center grid-style-2" style={{ height: '141.516px' }}>
                            <div className="title-wrapper">
                              <p className="name product-title woocommerce-loop-product__title" style={{ height: '50.9844px' }}>
                                <a href={item.href} className="woocommerce-LoopProduct-link woocommerce-loop-product__link">
                                  {item.name}
                                </a>
                              </p>
                            </div>
                            <div className="price-wrapper" style={{ height: '0px' }}></div>
                            {item.price && (
                              <div className="price-wrapper" style={{ marginTop: '5px' }}>
                                <span className="price">{item.price}</span>
                              </div>
                            )}
                            <div className="add-to-cart-button" style={{ height: '52.5px' }}>
                              <a href={item.href} className="primary is-small mb-0 button product_type_simple is-outline">
                                Xem chi tiết
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col large-12 text-center" style={{ padding: '50px 0', width: '100%' }}>
                    <p style={{ fontSize: '18px', color: '#666' }}>
                      Không tìm thấy sản phẩm hoặc dịch vụ nào phù hợp với từ khóa của bạn.
                    </p>
                  </div>
                )}
              </div>
              
              <div className="page-description">
                <p>
                  Với hơn 10 năm kinh nghiệm trong ngành gia công, chúng tôi cam kết mang đến cho bạn những sản phẩm đạt chuẩn quốc tế, luôn đáp ứng yêu cầu về chất lượng, độ chính xác và thời gian giao hàng.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
      
      {/* After Footer Content */}
      <SafeHTML html={afterFooter} />
      
      {/* ClientPage registers class name and hooks events */}
      <ClientPage bodyClass={bodyClass} />
    </div>
  );
}
