import React from 'react';
import { getPageData } from '@/utils/pageParser';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ClientPage, { SafeHTML } from '@/components/ClientPage';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page Not Found - Giacong.vn',
};

export default async function NotFound() {
  let data = null;
  try {
    data = await getPageData('chi-tiet-tin-tuc');
  } catch (error) {
    console.error('Error fetching 404 page data:', error);
  }

  if (!data) {
    // Robust static JSX fallback
    return (
      <div id="original-content">
        <title>Page Not Found - Giacong.vn</title>
        <Header />
        <main className="py-20 text-center px-4" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="max-w-md mx-auto">
            <h1 className="text-6xl font-bold text-red-600 mb-4" style={{ fontSize: '4rem', color: '#e53e3e', marginBottom: '1rem' }}>404</h1>
            <h2 className="text-2xl font-semibold mb-6" style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1.5rem' }}>Không tìm thấy trang</h2>
            <p className="text-gray-600 mb-8" style={{ color: '#718096', marginBottom: '2rem' }}>
              Trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển.
            </p>
            <a
              href="/"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
              style={{
                display: 'inline-block',
                backgroundColor: '#3182ce',
                color: '#fff',
                fontWeight: '600',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                textDecoration: 'none'
              }}
            >
              Về trang chủ
            </a>
          </div>
        </main>
        <Footer />
        <ClientPage bodyClass="error404" />
      </div>
    );
  }

  return (
    <div id="original-content">
      <title>Page Not Found - Giacong.vn</title>
      {/* Before Header Content (widgets, style tags, custom widgets) */}
      <SafeHTML html={data.beforeHeader} />
      
      <Header />
      
      {/* Main content */}
      <div dangerouslySetInnerHTML={{ __html: data.content }} suppressHydrationWarning={true} />
      
      <Footer />
      
      {/* After Footer Content (mobile sidebar menus, scripts, live chat) */}
      <SafeHTML html={data.afterFooter} />
      
      {/* ClientPage dynamically registers class name and hooks events */}
      <ClientPage bodyClass={data.bodyClass || 'error404'} />
    </div>
  );
}
