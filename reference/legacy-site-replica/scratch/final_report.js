const fs = require('fs');
const path = require('path');
const http = require('http');

const PAGES_DIR = path.join(__dirname, '..', 'frontend', 'src', 'data', 'pages');

const stats = {
  rawHrefsCount: 0,
  exclusions: {
    mailTelSmsJsHash: 0,
    externalDomains: 0,
    externalShares: 0,
    numericPhoneZalo: 0,
    wpTechnical: 0,
    assets: 0
  },
  validPaths: new Set(),
  local200OnDisk: 0,
  local404OnDisk: 0,
  local200OnServer: 0,
  local404OnServer: 0,
  server404List: [],
  server200List: []
};

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

  try {
    p = decodeURIComponent(p);
  } catch (e) {}

  if (p.length > 1 && p.endsWith('/')) {
    p = p.slice(0, -1);
  }

  return p;
}

function checkExclusions(href) {
  if (/^(mailto:|tel:|sms:|javascript:|whatsapp:|zalo:)/i.test(href) || href.startsWith('#') || href === '') {
    return { excluded: true, category: 'mailTelSmsJsHash' };
  }

  if (href.includes('<%') || href.includes('%>')) {
    return { excluded: true, category: 'mailTelSmsJsHash' };
  }

  if (/^(https?:)?\/\//i.test(href)) {
    if (!/^(https?:)?\/\/(?:www\.)?giacong\.vn/i.test(href)) {
      return { excluded: true, category: 'externalDomains' };
    }
  }

  const normalized = normalizePath(href);

  const shareRegex = /^\/?(sharer\.php|share|pin\/create\/button|shareArticle)(?:\/|$)/i;
  if (shareRegex.test(normalized)) {
    return { excluded: true, category: 'externalShares' };
  }

  const numericPhoneZaloRegex = /^\/?(?:zalo(?:\/|$)|(?:\d+)(?:\/|$))/i;
  if (numericPhoneZaloRegex.test(normalized)) {
    return { excluded: true, category: 'numericPhoneZalo' };
  }

  if (/^\/?(wp-.*|feed|comments\/feed|xmlrpc\.php)$/i.test(normalized)) {
    return { excluded: true, category: 'wpTechnical' };
  }

  const assetExtensions = /\.(jpg|jpeg|png|gif|webp|pdf|css|js|woff|woff2|ttf|eot|svg|ico|mp4|mp3|xml|txt)$/i;
  if (assetExtensions.test(normalized) || /^\/?(wp-content\/uploads|assets|wp-includes)\//i.test(normalized)) {
    return { excluded: true, category: 'assets' };
  }

  return { excluded: false, normalized };
}

function pathToLocalFile(normalizedPath) {
  let cleanPath = normalizedPath;
  if (cleanPath.startsWith('/')) {
    cleanPath = cleanPath.slice(1);
  }
  if (cleanPath === '' || cleanPath === 'home') {
    return path.join(PAGES_DIR, 'home.ejs');
  }
  return path.join(PAGES_DIR, cleanPath + '.ejs');
}

function get(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode });
      });
    }).on('error', (err) => {
      resolve({ statusCode: 0 });
    });
  });
}

async function run() {
  const files = getEjsFiles(PAGES_DIR);
  console.log(`Scanning ALL ${files.length} EJS files (including newly captured)...`);

  const hrefRegex = /href=["']([^"']+)["']/gi;

  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    let match;

    while ((match = hrefRegex.exec(content)) !== null) {
      const rawHref = match[1];
      stats.rawHrefsCount++;

      const res = checkExclusions(rawHref);
      if (res.excluded) {
        stats.exclusions[res.category]++;
      } else {
        let finalPath = res.normalized;
        if (!finalPath.startsWith('/')) {
          finalPath = '/' + finalPath;
        }
        stats.validPaths.add(finalPath);
      }
    }
  });

  const sortedPaths = Array.from(stats.validPaths).sort();
  console.log('\n=======================================');
  console.log('FINAL SWEEP AND PORT 3002 VERIFICATION');
  console.log('=======================================');
  console.log(`Raw href attributes parsed: ${stats.rawHrefsCount}`);
  console.log('Exclusions count by category:');
  Object.keys(stats.exclusions).forEach(cat => {
    console.log(`  - ${cat}: ${stats.exclusions[cat]}`);
  });
  console.log(`Valid content paths count: ${sortedPaths.length}`);

  // Disk & Server check
  for (const p of sortedPaths) {
    const localFile = pathToLocalFile(p);
    if (fs.existsSync(localFile)) {
      stats.local200OnDisk++;
    } else {
      stats.local404OnDisk++;
    }

    const res = await get(`http://localhost:3002${p}`);
    if (res.statusCode === 200) {
      stats.local200OnServer++;
      stats.server200List.push(p);
    } else {
      stats.local404OnServer++;
      stats.server404List.push(p);
    }
  }

  console.log('\nLocal Disk Status:');
  console.log(`  - EJS files present on disk: ${stats.local200OnDisk}`);
  console.log(`  - EJS files missing on disk: ${stats.local404OnDisk}`);
  console.log('Local Server (port 3002) Status:');
  console.log(`  - Returns 200 OK: ${stats.local200OnServer}`);
  console.log(`  - Returns 404 Not Found: ${stats.local404OnServer}`);
  if (stats.server404List.length > 0) {
    console.log('Server 404 paths:');
    stats.server404List.forEach(p => {
      console.log(`    * ${p}`);
    });
  }
}

run();
