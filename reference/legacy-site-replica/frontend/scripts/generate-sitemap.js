/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const metadataPath = path.join(__dirname, '../src/data/metadata.json');
const sitemapPath = path.join(__dirname, '../public/sitemap.xml');

try {
  const data = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  const pages = data.pages || [];

  const filteredPages = pages.filter(page => {
    const title = page.title || '';
    return !title.toLowerCase().includes('page not found');
  });

  const urls = filteredPages.map(page => {
    let slug = page.slug || '';
    // Map home to /
    if (slug === 'home') {
      return 'https://giacong.vn/';
    }
    
    // Normalize path slash if there's any.
    // Usually slug is relative to host, e.g. "gioi-thieu-ve-gia-cong" or "bot-gia-vi/something"
    // Clean leading/trailing slashes from slug
    slug = slug.replace(/^\/+|\/+$/g, '');
    
    return `https://giacong.vn/${slug}`;
  });

  // Remove duplicates
  const uniqueUrls = [...new Set(urls)];

  const xmlEntries = uniqueUrls.map(url => {
    return `  <url>\n    <loc>${url}</loc>\n  </url>`;
  }).join('\n');

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlEntries}
</urlset>\n`;

  fs.writeFileSync(sitemapPath, sitemapXml, 'utf8');
  console.log(`Successfully generated sitemap.xml with ${uniqueUrls.length} entries.`);
} catch (err) {
  console.error('Error generating sitemap:', err);
  process.exit(1);
}
