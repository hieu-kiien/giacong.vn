/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const robotsPath = path.join(__dirname, '../public/robots.txt');
const sitemapPath = path.join(__dirname, '../public/sitemap.xml');
const metadataPath = path.join(__dirname, '../src/data/metadata.json');

let failed = false;

function assert(condition, message) {
  if (!condition) {
    console.error('❌ Fail:', message);
    failed = true;
  } else {
    console.log('✅ Pass:', message);
  }
}

console.log('--- Verifying SEO Assets ---');

// 1. Verify robots.txt
if (!fs.existsSync(robotsPath)) {
  assert(false, 'robots.txt exists');
} else {
  const robotsText = fs.readFileSync(robotsPath, 'utf8');
  assert(robotsText.includes('Allow: /'), 'robots.txt allows all');
  assert(robotsText.includes('Disallow: /search'), 'robots.txt disallows /search');
  assert(robotsText.includes('Sitemap: https://giacong.vn/sitemap.xml'), 'robots.txt references sitemap.xml');
}

// 2. Verify sitemap.xml
if (!fs.existsSync(sitemapPath)) {
  assert(false, 'sitemap.xml exists');
} else {
  const sitemapXml = fs.readFileSync(sitemapPath, 'utf8');
  assert(sitemapXml.includes('<loc>https://giacong.vn/</loc>'), 'sitemap.xml contains mapped home page');
  
  // Verify 404 pages are filtered
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  const allPages = metadata.pages || [];
  
  const pageNotFoundPages = allPages.filter(p => (p.title || '').toLowerCase().includes('page not found'));
  let found404InSitemap = false;
  
  for (const page of pageNotFoundPages) {
    const loc = `https://giacong.vn/${page.slug}`;
    if (sitemapXml.includes(`<loc>${loc}</loc>`)) {
      found404InSitemap = true;
      break;
    }
  }
  
  assert(!found404InSitemap, 'sitemap.xml does not contain any "Page Not Found" pages');
}

if (failed) {
  process.exit(1);
} else {
  console.log('--- All SEO asset checks passed successfully ---');
}
