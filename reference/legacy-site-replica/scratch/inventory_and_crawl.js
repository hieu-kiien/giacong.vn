const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// Root paths
const ROOT_DIR = path.join(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const PAGES_DIR = path.join(FRONTEND_DIR, 'src', 'data', 'pages');
const ROOT_METADATA_PATH = path.join(ROOT_DIR, 'metadata.json');
const FRONTEND_METADATA_PATH = path.join(FRONTEND_DIR, 'src', 'data', 'metadata.json');

// Stats object
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
  local200Count: 0,
  local404Count: 0,
  target200Count: 0,
  target404Count: 0,
  targetTimeoutCount: 0,
  targetFailuresList: []
};

// Help helper to recursively find EJS files
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

// URL/Path normalization
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

// Categorization and exclusion logic
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

  // 3. External domains (excluding giacong.vn)
  if (/^(https?:)?\/\//i.test(href)) {
    if (!/^(https?:)?\/\/(?:www\.)?giacong\.vn/i.test(href)) {
      return { excluded: true, category: 'externalDomains' };
    }
  }

  const normalized = normalizePath(href);

  // 4. External share endpoints (/sharer.php, /share, /pin/create/button, /shareArticle)
  const shareRegex = /^\/?(sharer\.php|share|pin\/create\/button|shareArticle)(?:\/|$)/i;
  if (shareRegex.test(normalized)) {
    return { excluded: true, category: 'externalShares' };
  }

  // 5. Numeric phone/zalo path artifacts
  const numericPhoneZaloRegex = /^\/?(?:zalo(?:\/|$)|(?:\d+)(?:\/|$))/i;
  if (numericPhoneZaloRegex.test(normalized)) {
    return { excluded: true, category: 'numericPhoneZalo' };
  }

  // 6. WordPress technical endpoints (/wp-*, /feed, /comments/feed, /xmlrpc.php)
  if (/^\/?(wp-.*|feed|comments\/feed|xmlrpc\.php)$/i.test(normalized)) {
    return { excluded: true, category: 'wpTechnical' };
  }

  // 7. Asset paths
  const assetExtensions = /\.(jpg|jpeg|png|gif|webp|pdf|css|js|woff|woff2|ttf|eot|svg|ico|mp4|mp3|xml|txt)$/i;
  if (assetExtensions.test(normalized) || /^\/?(wp-content\/uploads|assets|wp-includes)\//i.test(normalized)) {
    return { excluded: true, category: 'assets' };
  }

  return { excluded: false, normalized };
}

// Map a normalized path to its local EJS filesystem path
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

// Custom request function with redirect-following and 10s timeout
function fetchUrl(targetUrl, timeoutMs = 10000, redirectCount = 0) {
  return new Promise((resolve) => {
    if (redirectCount > 5) {
      resolve({ statusCode: 0, error: 'Too many redirects', finalUrl: targetUrl });
      return;
    }

    const parsedUrl = new URL(targetUrl);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: timeoutMs
    };

    const protocol = parsedUrl.protocol === 'https:' ? require('https') : require('http');

    const req = protocol.request(options, (res) => {
      // Handle redirects (301, 302, 307, 308)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
          const host = parsedUrl.host;
          const proto = parsedUrl.protocol;
          if (redirectUrl.startsWith('/')) {
            redirectUrl = `${proto}//${host}${redirectUrl}`;
          } else {
            redirectUrl = `${proto}//${host}/${redirectUrl}`;
          }
        }
        resolve(fetchUrl(redirectUrl, timeoutMs, redirectCount + 1));
        return;
      }

      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: body,
          finalUrl: targetUrl
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ statusCode: 0, error: 'Timeout', finalUrl: targetUrl });
    });

    req.on('error', (err) => {
      resolve({ statusCode: 0, error: err.message, finalUrl: targetUrl });
    });

    req.end();
  });
}

// Partition HTML to Header/Footer/EJS partial structure
function partitionHtml(html) {
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) ||
                    html.match(/<meta\s+content="([^"]*)"\s+name="description"/i);
  const description = (descMatch && descMatch[1]) ? descMatch[1].trim() : '';

  const bodyClassMatch = html.match(/<body\s+class=["']([^"']+)["']/i);
  const bodyClass = bodyClassMatch ? bodyClassMatch[1] : '';

  const bodyStartIdx = html.indexOf('<body');
  const headerStartIdx = html.indexOf('<header id="header"');
  let headerEndIdx = -1;
  if (headerStartIdx !== -1) {
    headerEndIdx = html.indexOf('</header>', headerStartIdx) + 9;
  }
  const footerStartIdx = html.indexOf('<footer id="footer"');
  let footerEndIdx = -1;
  if (footerStartIdx !== -1) {
    footerEndIdx = html.indexOf('</footer>', footerStartIdx) + 9;
  }

  let preHeader = '';
  let bodyContent = '';
  let postFooter = '';

  if (bodyStartIdx !== -1 && headerStartIdx !== -1 && footerStartIdx !== -1 && headerEndIdx !== -1 && footerEndIdx !== -1) {
    preHeader = html.substring(bodyStartIdx, headerStartIdx);
    bodyContent = html.substring(headerEndIdx, footerStartIdx);
    postFooter = html.substring(footerEndIdx);
  } else {
    // Fallback extract everything inside <body>
    const bodyStartTagEndIdx = html.indexOf('>', bodyStartIdx) + 1;
    const bodyEndIdx = html.indexOf('</body>');
    if (bodyStartIdx !== -1 && bodyEndIdx !== -1) {
      preHeader = html.substring(bodyStartIdx, bodyStartTagEndIdx);
      bodyContent = html.substring(bodyStartTagEndIdx, bodyEndIdx);
      postFooter = '</body></html>';
    } else {
      bodyContent = html;
    }
  }

  return { title, description, bodyClass, preHeader, bodyContent, postFooter };
}

// Update both metadata.json files
function updateMetadata(slug, title, description, targetUrl) {
  [ROOT_METADATA_PATH, FRONTEND_METADATA_PATH].forEach(metaPath => {
    try {
      if (!fs.existsSync(metaPath)) return;
      const data = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      if (!data.pages) data.pages = [];

      // Check if page already exists in metadata
      const existingIdx = data.pages.findIndex(p => p.slug === slug);
      const pageInfo = {
        url: targetUrl,
        slug: slug === '' ? 'home' : slug,
        title: title || 'Giacong.vn',
        description: description || '',
        links: [],
        scrapedAt: new Date().toISOString(),
        source: 'scraped'
      };

      if (existingIdx !== -1) {
        data.pages[existingIdx] = { ...data.pages[existingIdx], ...pageInfo };
      } else {
        data.pages.push(pageInfo);
      }
      data.pagesCount = data.pages.length;

      fs.writeFileSync(metaPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error(`Error updating metadata at ${metaPath}:`, e.message);
    }
  });
}

async function run() {
  console.log('--- PHASE 1: SWEEPING EJS FILES FOR PATHS ---');
  const files = getEjsFiles(PAGES_DIR);
  console.log(`Found ${files.length} local EJS files.`);

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
  console.log(`Raw href attributes parsed: ${stats.rawHrefsCount}`);
  console.log('Exclusions applied:');
  Object.keys(stats.exclusions).forEach(cat => {
    console.log(`  - ${cat}: ${stats.exclusions[cat]}`);
  });
  console.log(`Unique valid content paths: ${sortedPaths.length}`);

  console.log('\n--- PHASE 2: INVENTORYING LOCAL DISK ---');
  const local404Paths = [];
  const local200Paths = [];

  sortedPaths.forEach(p => {
    const localFile = pathToLocalFile(p);
    if (fs.existsSync(localFile)) {
      stats.local200Count++;
      local200Paths.push(p);
    } else {
      stats.local404Count++;
      local404Paths.push(p);
    }
  });

  console.log(`Local 200 (exist on disk): ${stats.local200Count}`);
  console.log(`Local 404 (missing on disk): ${stats.local404Count}`);

  console.log('\n--- PHASE 3: CAPTURING TARGET GIACONG.VN FOR LOCAL 404s ---');
  if (local404Paths.length === 0) {
    console.log('No local 404 paths to capture.');
  } else {
    console.log(`Starting sequential crawl of ${local404Paths.length} paths...`);
    
    for (let i = 0; i < local404Paths.length; i++) {
      const p = local404Paths[i];
      const targetUrl = `https://giacong.vn${p}`;
      const localFile = pathToLocalFile(p);

      console.log(`[${i + 1}/${local404Paths.length}] Fetching ${targetUrl}...`);
      
      const fetchRes = await fetchUrl(targetUrl);
      
      if (fetchRes.statusCode === 200) {
        stats.target200Count++;
        const partition = partitionHtml(fetchRes.body);
        
        // Assemble standard EJS page
        const pageContent = [
          "<%- include('../partials/head') %>",
          partition.preHeader,
          "<%- include('../partials/header') %>",
          partition.bodyContent,
          "<%- include('../partials/footer') %>",
          partition.postFooter
        ].join('\n');

        // Create directory structure if needed
        fs.mkdirSync(path.dirname(localFile), { recursive: true });
        
        // Persist file
        fs.writeFileSync(localFile, pageContent, 'utf8');
        console.log(`  -> SUCCESS. Saved to: ${localFile.replace(ROOT_DIR, '')} (${Buffer.byteLength(pageContent)} bytes)`);
        
        // Update metadata.json
        const slug = p === '/' ? 'home' : p.slice(1);
        updateMetadata(slug, partition.title, partition.description, targetUrl);

      } else if (fetchRes.statusCode === 404) {
        stats.target404Count++;
        stats.targetFailuresList.push({ path: p, reason: '404 Page Not Found' });
        console.log(`  -> 404 Not Found on target.`);
      } else {
        stats.targetTimeoutCount++;
        const reason = fetchRes.error || `HTTP ${fetchRes.statusCode}`;
        stats.targetFailuresList.push({ path: p, reason: reason });
        console.log(`  -> FAILURE: ${reason}`);
      }
    }
  }

  console.log('\n--- CAPTURE RUN COMPLETE ---');
  console.log(`Scrape successful 200s: ${stats.target200Count}`);
  console.log(`Scrape 404s (retained local 404): ${stats.target404Count}`);
  console.log(`Scrape timeouts/failures (retained local 404): ${stats.targetTimeoutCount}`);
  if (stats.targetFailuresList.length > 0) {
    console.log('Failed paths list:');
    stats.targetFailuresList.forEach(fail => {
      console.log(`  - ${fail.path} (${fail.reason})`);
    });
  }

  // Save final report to scratch
  const reportPath = path.join(__dirname, 'inventory_and_crawl_report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    stats: {
      rawHrefsCount: stats.rawHrefsCount,
      exclusions: stats.exclusions,
      validContentPathsCount: sortedPaths.length,
      initialLocal200: stats.local200Count,
      initialLocal404: stats.local404Count,
      scrapedTarget200: stats.target200Count,
      scrapedTarget404: stats.target404Count,
      scrapedTargetTimeoutsFailures: stats.targetTimeoutCount
    },
    targetFailures: stats.targetFailuresList
  }, null, 2), 'utf8');
  console.log(`\nSaved execution report to ${reportPath}`);
}

run();
