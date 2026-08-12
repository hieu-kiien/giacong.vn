const fs = require('fs');
const path = require('path');

const metadataPath = 'c:/Users/hieuk/Desktop/Tham khảo giacong.vn/frontend/src/data/metadata.json';
const sitemapPath = 'c:/Users/hieuk/Desktop/Tham khảo giacong.vn/frontend/public/sitemap.xml';

console.log('--- Stress Testing & Auditing SEO Metadata ---');

if (!fs.existsSync(metadataPath)) {
  console.error('metadata.json not found!');
  process.exit(1);
}

const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const pages = metadata.pages || [];

console.log(`Loaded ${pages.length} pages from metadata.json`);

// 1. Check for empty slugs or titles
const emptySlugs = pages.filter(p => !p.slug);
const emptyTitles = pages.filter(p => !p.title);
console.log(`Pages with empty slugs: ${emptySlugs.length}`);
console.log(`Pages with empty titles: ${emptyTitles.length}`);

// 2. Check for duplicate slugs
const slugCounts = {};
pages.forEach(p => {
  if (p.slug) {
    slugCounts[p.slug] = (slugCounts[p.slug] || 0) + 1;
  }
});
const duplicates = Object.keys(slugCounts).filter(s => slugCounts[s] > 1);
console.log(`Duplicate slugs found: ${duplicates.length}`);
if (duplicates.length > 0) {
  console.log('Duplicate list:', duplicates.slice(0, 10));
}

// 3. Check for URL-unsafe characters in slugs
const urlUnsafeRegex = /[^a-zA-Z0-9\-\.\_\~\!\$\&\'\(\)\*\+\,\;\=\:\@\/%]/;
const unsafeSlugs = pages.filter(p => p.slug && urlUnsafeRegex.test(p.slug));
console.log(`Slugs with URL-unsafe characters: ${unsafeSlugs.length}`);
if (unsafeSlugs.length > 0) {
  console.log('Unsafe slugs list:', unsafeSlugs.map(p => p.slug).slice(0, 10));
}

// 4. Verify sitemap.xml XML escaping
if (fs.existsSync(sitemapPath)) {
  const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');
  console.log('sitemap.xml length:', sitemapContent.length, 'bytes');
  
  // XML requires escaping for: &, <, >, ", '
  // If there's an unescaped '&' in sitemap.xml, it will fail XML parsing.
  const hasUnescapedAmpersand = /&(?![a-zA-Z0-9#]+;)/.test(sitemapContent);
  console.log(`Contains unescaped ampersands: ${hasUnescapedAmpersand}`);
  
  const hasUnescapedLessThan = /<(?!\/?(urlset|url|loc)>)/.test(sitemapContent);
  console.log(`Contains unescaped less-than: ${hasUnescapedLessThan}`);
} else {
  console.warn('sitemap.xml not found!');
}
