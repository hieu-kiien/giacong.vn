const fs = require('fs');
const path = require('path');

// Target directory containing EJS files
const PAGES_DIR = path.join(__dirname, '..', 'frontend', 'src', 'data', 'pages');

// Keep track of statistics
const stats = {
  rawHrefsCount: 0,
  categories: {
    mailTelSmsJsHash: 0,
    externalDomains: 0,
    externalShares: 0,
    numericPhoneZalo: 0,
    wpTechnical: 0,
    assets: 0
  },
  validPaths: new Set(),
  excludedItems: {} // for debugging/reporting
};

// Recursive EJS file finder
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

// Normalize path to relative slug
function normalizePath(href) {
  if (!href) return '';
  let p = href.trim();

  // 1. Remove giacong.vn domain prefix
  p = p.replace(/^https?:\/\/(?:www\.)?giacong\.vn/i, '');
  p = p.replace(/^\/\/(?:www\.)?giacong\.vn/i, '');

  // 2. Remove query parameters and hash fragments
  p = p.split('?')[0].split('#')[0];

  // 3. Decode URI components
  try {
    p = decodeURIComponent(p);
  } catch (e) {
    // Ignore decode error and keep original
  }

  // 4. Remove trailing slash (except if it is just '/')
  if (p.length > 1 && p.endsWith('/')) {
    p = p.slice(0, -1);
  }

  return p;
}

// Categorize and filter hrefs
function checkExclusions(href) {
  if (!href) return { excluded: true, category: 'mailTelSmsJsHash' };

  // 1. EJS dynamic template tags (exclude immediately)
  if (href.includes('<%') || href.includes('%>')) {
    return { excluded: true, category: 'mailTelSmsJsHash' };
  }

  // 2. Mail/Tel/SMS/JS/Hash / Custom URI (whatsapp)
  const cleanHref = href.trim().replace(/^\/+/, '');
  if (/^(mailto:|tel:|sms:|javascript:|whatsapp:|zalo:)/i.test(cleanHref) || href.startsWith('#') || href === '') {
    return { excluded: true, category: 'mailTelSmsJsHash' };
  }

  const normalized = normalizePath(href);

  // 3. External domains (excluding giacong.vn)
  if (/^(https?:)?\/\//i.test(href)) {
    if (!/^(https?:)?\/\/(?:www\.)?giacong\.vn/i.test(href)) {
      return { excluded: true, category: 'externalDomains' };
    }
  }

  // 3. External share endpoints
  // (/sharer.php, /share, /pin/create/button, /shareArticle)
  const shareRegex = /^\/?(sharer\.php|share|pin\/create\/button|shareArticle)(?:\/|$)/i;
  if (shareRegex.test(normalized)) {
    return { excluded: true, category: 'externalShares' };
  }

  // 4. Numeric phone/zalo path artifacts
  // Purely numeric paths, or starts with /zalo
  const numericPhoneZaloRegex = /^\/?(?:zalo(?:\/|$)|(?:\d+)(?:\/|$))/i;
  if (numericPhoneZaloRegex.test(normalized)) {
    return { excluded: true, category: 'numericPhoneZalo' };
  }

  // 5. WordPress technical endpoints
  // (/wp-*, /feed, /comments/feed, /xmlrpc.php)
  if (/^\/?(wp-.*|feed|comments\/feed|xmlrpc\.php)$/i.test(normalized)) {
    return { excluded: true, category: 'wpTechnical' };
  }

  // 6. Asset paths
  // Ends with typical asset extensions, or starts with /wp-content/uploads/ or /assets/
  const assetExtensions = /\.(jpg|jpeg|png|gif|webp|pdf|css|js|woff|woff2|ttf|eot|svg|ico|mp4|mp3|xml|txt)$/i;
  if (assetExtensions.test(normalized) || /^\/?(wp-content\/uploads|assets|wp-includes)\//i.test(normalized)) {
    return { excluded: true, category: 'assets' };
  }

  return { excluded: false, normalized };
}

function sweep() {
  const files = getEjsFiles(PAGES_DIR);
  console.log(`Found ${files.length} EJS files to scan.`);

  const hrefRegex = /href=["']([^"']+)["']/gi;

  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    let match;

    while ((match = hrefRegex.exec(content)) !== null) {
      const rawHref = match[1];
      stats.rawHrefsCount++;

      const res = checkExclusions(rawHref);
      if (res.excluded) {
        stats.categories[res.category]++;
        if (!stats.excludedItems[res.category]) {
          stats.excludedItems[res.category] = new Set();
        }
        stats.excludedItems[res.category].add(rawHref);
      } else {
        // Ensure path starts with a slash
        let finalPath = res.normalized;
        if (!finalPath.startsWith('/')) {
          finalPath = '/' + finalPath;
        }
        stats.validPaths.add(finalPath);
      }
    }
  });

  console.log('\n--- SWEEP RESULTS ---');
  console.log(`Raw href attributes found: ${stats.rawHrefsCount}`);
  console.log('Exclusions by category:');
  Object.keys(stats.categories).forEach(cat => {
    console.log(`  - ${cat}: ${stats.categories[cat]} (unique: ${stats.excludedItems[cat] ? stats.excludedItems[cat].size : 0})`);
  });
  console.log(`Unique valid content/navigation paths: ${stats.validPaths.size}`);
  
  // Save valid paths to a file for capture
  const outputPath = path.join(__dirname, 'valid_paths.json');
  fs.writeFileSync(outputPath, JSON.stringify(Array.from(stats.validPaths).sort(), null, 2), 'utf8');
  console.log(`Saved valid paths to ${outputPath}`);
}

sweep();
