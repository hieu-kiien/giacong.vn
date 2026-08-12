import React from 'react';
import { getPageData } from '@/utils/pageParser';
import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ClientPage, { SafeHTML } from '@/components/ClientPage';

interface Post {
  id: number;
  title: string;
  slug: string;
  content: string | null;
  image: string | null;
  published_at: string | null;
}

interface PaginatedResponse {
  data?: Post[];
  current_page?: number;
  last_page?: number;
  total?: number;
}

interface PageProps {
  searchParams: Promise<{
    page?: string;
  }>;
}

function getExcerpt(content: string | null): string {
  if (!content) return '';
  const stripped = content.replace(/<[^>]+>/g, '');
  if (stripped.length <= 150) return stripped;
  return stripped.substring(0, 150) + '...';
}

function getImageUrl(image: string | null): string {
  if (!image) {
    return '/assets/images/call.webp'; // standard fallback
  }
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return image;
  }
  if (image.startsWith('storage/')) {
    const apiHost = process.env.LARAVEL_API_URL || 'http://localhost:8002';
    return `${apiHost}/${image}`;
  }
  return image;
}

export async function generateMetadata(): Promise<Metadata> {
  const pageData = await getPageData('tin-tuc');
  return {
    title: pageData?.title || 'Tin tức - Giacong.vn',
    description: pageData?.description || '',
  };
}

export default async function TinTucPage({ searchParams }: PageProps) {
  const { page } = await searchParams;
  const pageNumber = page ? parseInt(page, 10) : 1;
  const pageData = await getPageData('tin-tuc');
  
  let posts: Post[] = [];
  let currentPage = pageNumber;
  let lastPage = 1;
  let total = 0;
  
  try {
    const apiHost = process.env.LARAVEL_API_URL || 'http://localhost:8002';
    const res = await fetch(`${apiHost}/api/posts?page=${pageNumber}`, { cache: 'no-store' });
    if (res.ok) {
      const data: PaginatedResponse = await res.json();
      posts = data.data || [];
      currentPage = data.current_page || pageNumber;
      lastPage = data.last_page || 1;
      total = data.total || 0;
    } else {
      console.error(`Failed to fetch posts from backend: ${res.statusText}`);
    }
  } catch (err) {
    console.error('Error fetching posts:', err);
  }

  return (
    <div id="original-content">
      {pageData?.beforeHeader && <SafeHTML html={pageData.beforeHeader} />}
      <Header />
      
      <main id="main" className="">
        <div id="content" className="blog-wrapper blog-archive page-wrapper">
          <header className="archive-page-header">
            <div className="row">
              <div className="large-12 text-center col">
                <nav aria-label="breadcrumbs" className="rank-math-breadcrumb">
                  <p>
                    <a href="/">Trang chủ</a>
                    <span className="separator"> » </span>
                    <span className="last">Tin tức</span>
                  </p>
                </nav>
                <h1 className="page-title is-large uppercase">
                  <span>Tin tức</span>
                </h1>
              </div>
            </div>
          </header>
          
          <div className="row align-center">
            <div className="large-12 col">
              {posts.length === 0 ? (
                <section className="no-results not-found text-center py-20">
                  <p className="text-gray-600">Không tìm thấy bài viết nào.</p>
                </section>
              ) : (
                <>
                  <div className="row large-columns-3 medium-columns-3 small-columns-1" style={{ display: 'flex', flexWrap: 'wrap', gap: '20px 0' }}>
                    {posts.map((post) => (
                      <div key={post.id} className="col post-item">
                        <div className="col-inner">
                          <a href={`/${post.slug}`} className="plain">
                            <div className="box box-text-bottom box-blog-post has-hover">
                              <div className="box-image">
                                <div className="image-cover" style={{ paddingTop: '56%', position: 'relative' }}>
                                  <img
                                    width="300"
                                    height="210"
                                    src={getImageUrl(post.image)}
                                    className="attachment-medium size-medium wp-post-image lazy-load-active"
                                    alt={post.title}
                                    decoding="async"
                                    style={{ objectFit: 'cover', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
                                  />
                                </div>
                              </div>
                              <div className="box-text text-left">
                                <div className="box-text-inner blog-post-inner">
                                  <h5 className="post-title is-large" style={{ fontSize: '18px', fontWeight: 'bold', color: '#333', marginBottom: '10px' }}>
                                    {post.title}
                                  </h5>
                                  <div className="is-divider" style={{ height: '2px', backgroundColor: '#5aa400', width: '30px', margin: '10px 0' }}></div>
                                  <p className="from_the_blog_excerpt" style={{ fontSize: '15px', color: '#505050' }}>
                                    {getExcerpt(post.content)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Pagination Section */}
                  <div className="container py-10" style={{ marginTop: '40px' }}>
                    <nav className="woocommerce-pagination">
                      <ul className="page-numbers nav-pagination links text-center" style={{ display: 'flex', justifyContent: 'center', listStyle: 'none', gap: '10px', alignItems: 'center' }}>
                        {currentPage > 1 && (
                          <li>
                            <a 
                              className="prev page-number" 
                              href={`/tin-tuc?page=${currentPage - 1}`}
                              style={{ padding: '8px 14px', background: '#f1f1f1', borderRadius: '4px', textDecoration: 'none', color: '#484848' }}
                            >
                              « Trước
                            </a>
                          </li>
                        )}
                        <li>
                          <span className="page-number current" style={{ padding: '8px 14px', background: '#5aa400', color: 'white', borderRadius: '4px', fontWeight: 'bold' }}>
                            Trang {currentPage} / {lastPage}
                          </span>
                        </li>
                        {currentPage < lastPage && (
                          <li>
                            <a 
                              className="next page-number" 
                              href={`/tin-tuc?page=${currentPage + 1}`}
                              style={{ padding: '8px 14px', background: '#f1f1f1', borderRadius: '4px', textDecoration: 'none', color: '#484848' }}
                            >
                              Sau »
                            </a>
                          </li>
                        )}
                      </ul>
                    </nav>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
      {pageData?.afterFooter && <SafeHTML html={pageData.afterFooter} />}
      
      <ClientPage bodyClass={pageData?.bodyClass || "archive category category-tin-tuc category-32 wp-theme-flatsome wp-child-theme-thiet-ke-web theme-flatsome woocommerce-js lightbox nav-dropdown-has-shadow nav-dropdown-has-border"} />
    </div>
  );
}
