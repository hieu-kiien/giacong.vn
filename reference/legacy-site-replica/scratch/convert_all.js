const fs = require('fs');
const path = require('path');

const htmlDir = path.join(__dirname, '..', 'html');
const assetsDir = path.join(__dirname, '..', 'assets');
const jsDir = path.join(assetsDir, 'js');
const imagesDir = path.join(assetsDir, 'images');

const jsFiles = fs.existsSync(jsDir) ? fs.readdirSync(jsDir) : [];
const localImages = fs.existsSync(imagesDir) ? fs.readdirSync(imagesDir) : [];

// Create folders if not exist
const viewsDir = path.join(__dirname, '..', 'views');
const partialsDir = path.join(viewsDir, 'partials');
const pagesDir = path.join(viewsDir, 'pages');

fs.mkdirSync(partialsDir, { recursive: true });
fs.mkdirSync(pagesDir, { recursive: true });

// Mapping function for JavaScript URLs
function mapUrlToLocalJS(url) {
    if (url.includes('sdk_cf910192.js') || url.includes('sdk_06b0e4e0.js')) {
        return '/assets/js/sdk_06b0e4e0.js';
    }
    
    let cleanUrl = url.split('?')[0];
    if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);
    
    const filename = path.basename(cleanUrl);
    const base = filename.replace(/\.js$/, '');
    const normalizedBase = base.toLowerCase().replace(/[\.\-]/g, '_');
    
    if (normalizedBase === 'onesignalsdk_page') {
        return '/assets/js/OneSignalSDK_page_7da17e76.js';
    }
    if (normalizedBase === 'onesignalsdk_page_es6') {
        return '/assets/js/OneSignalSDK_page_es6_ef86d105.js';
    }
    if (normalizedBase === 'sdk') {
        return '/assets/js/sdk_06b0e4e0.js';
    }
    if (filename === 'index.js') {
        if (url.includes('/swv/')) {
            return '/assets/js/index_ce3687a7.js';
        } else {
            return '/assets/js/index_49a6d269.js';
        }
    }

    for (const jsFile of jsFiles) {
        const parts = jsFile.replace(/\.js$/, '').split('_');
        if (parts.length > 1) {
            parts.pop(); // remove hash
        }
        const jsBaseClean = parts.join('_').toLowerCase().replace(/[\.\-]/g, '_');
        if (jsBaseClean === normalizedBase) {
            return `/assets/js/${jsFile}`;
        }
    }
    
    return null;
}

// Mapping function for Image URLs
function mapImageToLocal(url) {
    const filename = path.basename(url.split('?')[0]);
    let base = filename.replace(/\.[^.]+$/, '').toLowerCase();
    
    // Strip WP size suffix like -300x200 or -1536x1024
    base = base.replace(/-\d+x\d+$/, '');
    
    // Look for local image
    for (const img of localImages) {
        let imgBase = img.replace(/\.[^.]+$/, '').toLowerCase();
        // Remove hash from local image
        const parts = imgBase.split('_');
        if (parts.length > 1) {
            parts.pop(); // remove hash
        }
        let imgBaseNoHash = parts.join('_');
        // Strip size suffix from local image base name too if present
        imgBaseNoHash = imgBaseNoHash.replace(/-\d+x\d+$/, '');
        
        if (imgBaseNoHash === base) {
            return `/assets/images/${img}`;
        }
    }
    
    // Fallback: Try substring matching
    for (const img of localImages) {
        let imgBase = img.replace(/\.[^.]+$/, '').toLowerCase();
        if (imgBase.includes(base) || base.includes(imgBase.split('_')[0])) {
            return `/assets/images/${img}`;
        }
    }
    
    return null;
}

// Link cleaning function: replaces https://giacong.vn/... with relative links, strips trailing slashes
function cleanHref(href) {
    if (href.startsWith('https://giacong.vn')) {
        let route = href.substring('https://giacong.vn'.length);
        if (route === '' || route === '/') {
            return '/';
        }
        if (route.endsWith('/')) {
            route = route.slice(0, -1);
        }
        try {
            route = decodeURIComponent(route);
        } catch (e) {
            // ignore
        }
        return route.startsWith('/') ? route : '/' + route;
    }
    return href;
}

function cleanAllContent(content) {
    // 1. Replace relative assets with absolute root assets (../assets/... to /assets/...)
    let cleaned = content.replace(/\.\.\/assets\//g, '/assets/');

    // 2. Replace absolute URLs of pages with relative URLs
    cleaned = cleaned.replace(/href="(https:\/\/giacong\.vn[^"]*)"/gi, (match, url) => {
        return `href="${cleanHref(url)}"`;
    });

    // 3. Map remote scripts to local scripts
    cleaned = cleaned.replace(/<script\s+([^>]*src="([^"]+)"[^>]*)>/gi, (match, attrs, src) => {
        if (src.startsWith('http') || src.includes('wp-content') || src.includes('wp-includes')) {
            if (src.includes('googletagmanager.com')) {
                return match; // Keep GTM CDN URL
            }
            const localPath = mapUrlToLocalJS(src);
            if (localPath) {
                return `<script ${attrs.replace(src, localPath)}>`;
            }
        }
        return match;
    });

    // 4. Map remote images to local images
    cleaned = cleaned.replace(/<img\s+([^>]*src="([^"]+)"[^>]*)>/gi, (match, attrs, src) => {
        if (src.startsWith('http') || src.includes('wp-content')) {
            const localPath = mapImageToLocal(src);
            if (localPath) {
                return `<img ${attrs.replace(src, localPath)}>`;
            }
        }
        return match;
    });

    // 5. Replace font references
    cleaned = cleaned.replace(/https:\/\/giacong\.vn\/wp-content\/themes\/flatsome\/assets\/css\/icons\/fl-icons\.([a-z0-9?=#\-]+)/gi, (match, extAndQuery) => {
        const ext = extAndQuery.split(/[?#]/)[0];
        const suffix = extAndQuery.substring(ext.length);
        return `/assets/fonts/icons.${ext}${suffix}`;
    });

    return cleaned;
}

// ------------------------------
// STEP 1: CREATE PARTIALS
// ------------------------------

const interactivePath = path.join(htmlDir, 'home_interactive.html');
const interactiveContent = fs.readFileSync(interactivePath, 'utf8');

// Extract head from interactiveContent
const headStart = interactiveContent.indexOf('<head>');
const headEnd = interactiveContent.indexOf('</head>') + 7;
let rawHead = interactiveContent.substring(headStart, headEnd);

// Apply replacements to rawHead to make it head.ejs
let headEjs = cleanAllContent(rawHead);

// Now apply EJS interpolations for title, description, canonical, robots, ogImage
headEjs = headEjs
    .replace(/<title>[\s\S]*?<\/title>/i, '<title><%= typeof title !== \'undefined\' ? title : \'\' %></title>')
    .replace(/<meta\s+name="description"\s+content="[^"]*"/i, '<meta name="description" content="<%= typeof description !== \'undefined\' ? description : \'\' %>"')
    .replace(/<meta\s+content="[^"]*"\s+name="description"/i, '<meta name="description" content="<%= typeof description !== \'undefined\' ? description : \'\' %>"')
    .replace(/<link\s+rel="canonical"\s+href="[^"]*"/i, '<link rel="canonical" href="<%= typeof canonical !== \'undefined\' ? canonical : \'\' %>"')
    .replace(/<link\s+href="[^"]*"\s+rel="canonical"/i, '<link rel="canonical" href="<%= typeof canonical !== \'undefined\' ? canonical : \'\' %>"')
    .replace(/<meta\s+property="og:title"\s+content="[^"]*"/i, '<meta property="og:title" content="<%= typeof title !== \'undefined\' ? title : \'\' %>"')
    .replace(/<meta\s+property="og:description"\s+content="[^"]*"/i, '<meta property="og:description" content="<%= typeof description !== \'undefined\' ? description : \'\' %>"')
    .replace(/<meta\s+property="og:url"\s+content="[^"]*"/i, '<meta property="og:url" content="<%= typeof canonical !== \'undefined\' ? canonical : \'\' %>"')
    .replace(/<meta\s+name="twitter:title"\s+content="[^"]*"/i, '<meta name="twitter:title" content="<%= typeof title !== \'undefined\' ? title : \'\' %>"')
    .replace(/<meta\s+name="twitter:description"\s+content="[^"]*"/i, '<meta name="twitter:description" content="<%= typeof description !== \'undefined\' ? description : \'\' %>"')
    .replace(/<meta\s+name="twitter:image"\s+content="[^"]*"/i, '<meta name="twitter:image" content="<%= typeof ogImage !== \'undefined\' ? ogImage : \'/assets/images/GIACONG_VN-ngang-03-1-1024x291_b7977d0f.png\' %>"')
    .replace(/<meta\s+property="og:image"\s+content="[^"]*"/i, '<meta property="og:image" content="<%= typeof ogImage !== \'undefined\' ? ogImage : \'/assets/images/GIACONG_VN-ngang-03-1-1024x291_b7977d0f.png\' %>"')
    .replace(/<meta\s+property="og:image:secure_url"\s+content="[^"]*"/i, '<meta property="og:image:secure_url" content="<%= typeof ogImage !== \'undefined\' ? ogImage : \'/assets/images/GIACONG_VN-ngang-03-1-1024x291_b7977d0f.png\' %>"')
    .replace(/<meta\s+name="robots"\s+content="[^"]*"/i, '<meta name="robots" content="<%= typeof robots !== \'undefined\' ? robots : \'follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large\' %>"');

// Prepend standard html wrapper tags
headEjs = '<!DOCTYPE html>\n<html lang="vi" prefix="og: https://ogp.me/ns#" class="js">\n' + headEjs;

fs.writeFileSync(path.join(partialsDir, 'head.ejs'), headEjs, 'utf8');

// Extract and clean header
const headerStartIndex = interactiveContent.indexOf('<header id="header"');
const headerEndIndex = interactiveContent.indexOf('</header>', headerStartIndex) + 9;
const rawHeader = interactiveContent.substring(headerStartIndex, headerEndIndex);
const headerEjs = cleanAllContent(rawHeader);

fs.writeFileSync(path.join(partialsDir, 'header.ejs'), headerEjs, 'utf8');

// Extract and clean footer
const footerStartIndex = interactiveContent.indexOf('<footer id="footer"');
const footerEndIndex = interactiveContent.indexOf('</footer>', footerStartIndex) + 9;
const rawFooter = interactiveContent.substring(footerStartIndex, footerEndIndex);
const footerEjs = cleanAllContent(rawFooter);

fs.writeFileSync(path.join(partialsDir, 'footer.ejs'), footerEjs, 'utf8');

console.log('Successfully created layout partials (head, header, footer).');

// ------------------------------
// STEP 2: CONVERT ALL 44 PAGES
// ------------------------------

const files = fs.readdirSync(htmlDir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const filePath = path.join(htmlDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract page metadata
    const titleMatch = content.match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'No Title';

    const descMatch = content.match(/<meta\s+name="description"\s+content="([^"]*)"/i) ||
                      content.match(/<meta\s+content="([^"]*)"\s+name="description"/i);
    const desc = (descMatch && descMatch[1]) ? descMatch[1].trim() : '';

    const canonicalMatch = content.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i) ||
                          content.match(/<link\s+href="([^"]*)"\s+rel="canonical"/i);
    const canonical = (canonicalMatch && canonicalMatch[1]) ? cleanHref(canonicalMatch[1].trim()) : '';

    const robotsMatch = content.match(/<meta\s+name="robots"\s+content="([^"]*)"/i);
    const robots = (robotsMatch && robotsMatch[1]) ? robotsMatch[1].trim() : 'follow, index';

    // Split HTML content into parts
    const bodyStartTagIndex = content.indexOf('<body');
    const bodyStartTagEndIndex = content.indexOf('>', bodyStartTagIndex) + 1;
    const headerStartTagIndex = content.indexOf('<header id="header"');
    const headerEndTagIndex = content.indexOf('</header>', headerStartTagIndex) + 9;
    const footerStartTagIndex = content.indexOf('<footer id="footer"');
    const footerEndTagIndex = content.indexOf('</footer>', footerStartTagIndex) + 9;

    if (bodyStartTagIndex === -1 || headerStartTagIndex === -1 || footerStartTagIndex === -1) {
        console.log(`Error: File ${file} has non-standard layout!`);
        return;
    }

    // preHeader contains: <body ...> up to <header id="header">
    const preHeaderRaw = content.substring(bodyStartTagIndex, headerStartTagIndex);
    const preHeader = cleanAllContent(preHeaderRaw);

    // unique body content is between </header> and <footer id="footer">
    const bodyRaw = content.substring(headerEndTagIndex, footerStartTagIndex);
    const body = cleanAllContent(bodyRaw);

    // postFooter is after </footer> up to </html>
    const postFooterRaw = content.substring(footerEndTagIndex);
    const postFooter = cleanAllContent(postFooterRaw);

    // Assemble page template content
    const pageContent = [
        "<%- include('../partials/head') %>",
        preHeader,
        "<%- include('../partials/header') %>",
        body,
        "<%- include('../partials/footer') %>",
        postFooter
    ].join('\n');

    // Save page template
    const ejsFilename = file.replace(/\.html$/, '.ejs');
    fs.writeFileSync(path.join(pagesDir, ejsFilename), pageContent, 'utf8');
    console.log(`Converted ${file} => views/pages/${ejsFilename}`);
});

console.log('Conversion complete!');
