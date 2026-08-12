const fs = require('fs');
const path = require('path');
const PAGES_DIR = path.join(__dirname, '..', 'frontend', 'src', 'data', 'pages');

function getEjsFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getEjsFiles(filePath));
    } else if (file.endsWith('.ejs')) {
      results.push(filePath);
    }
  });
  return results;
}

function normalizePath(href) {
  if (!href) return '';
  let p = href.trim();
  p = p.replace(/^https?:\/\/(?:www\.)?giacong\.vn/i, '');
  p = p.replace(/^\/\/(?:www\.)?giacong\.vn/i, '');
  p = p.split('?')[0].split('#')[0];
  try { p = decodeURIComponent(p); } catch (e) {}
  if (p.length > 1 && p.endsWith('/')) { p = p.slice(0, -1); }
  return p;
}

const targets = new Set([
  '/digital-branding',
  '/gia-cong-bot-che',
  '/gia-cong-gel-chong-nang',
  '/google-ads',
  '/thiet-ke-website',
  '/thuc-pham'
]);

const files = getEjsFiles(PAGES_DIR);
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match;
  while ((match = hrefRegex.exec(content)) !== null) {
    const rawHref = match[1];
    let norm = normalizePath(rawHref);
    if (!norm.startsWith('/')) {
      norm = '/' + norm;
    }
    if (targets.has(norm)) {
      console.log(`${file} -> raw: ${rawHref} -> normalized: ${norm}`);
    }
  }
});
