const fs = require('fs');
const path = require('path');

const searchPath = path.join(__dirname, '..', 'views', 'pages', 'search.ejs');
const content = fs.readFileSync(searchPath, 'utf8');

const jsDir = path.join(__dirname, '..', 'assets', 'js');
const imagesDir = path.join(__dirname, '..', 'assets', 'images');
const jsFiles = fs.existsSync(jsDir) ? fs.readdirSync(jsDir) : [];
const localImages = fs.existsSync(imagesDir) ? fs.readdirSync(imagesDir) : [];

function mapUrlToLocalJS(url) {
    if (url.includes('sdk_cf910192.js') || url.includes('sdk_06b0e4e0.js')) {
        return '/assets/js/sdk_06b0e4e0.js';
    }
    let cleanUrl = url.split('?')[0];
    if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);
    const filename = path.basename(cleanUrl);
    const base = filename.replace(/\.js$/, '');
    const normalizedBase = base.toLowerCase().replace(/[\.\-]/g, '_');
    
    if (normalizedBase === 'onesignalsdk_page') return '/assets/js/OneSignalSDK_page_7da17e76.js';
    if (normalizedBase === 'onesignalsdk_page_es6') return '/assets/js/OneSignalSDK_page_es6_ef86d105.js';
    if (normalizedBase === 'sdk') return '/assets/js/sdk_06b0e4e0.js';
    if (filename === 'index.js') {
        if (url.includes('/swv/')) return '/assets/js/index_ce3687a7.js';
        return '/assets/js/index_49a6d269.js';
    }

    for (const jsFile of jsFiles) {
        const parts = jsFile.replace(/\.js$/, '').split('_');
        if (parts.length > 1) parts.pop();
        const jsBaseClean = parts.join('_').toLowerCase().replace(/[\.\-]/g, '_');
        if (jsBaseClean === normalizedBase) {
            return `/assets/js/${jsFile}`;
        }
    }
    return null;
}

function mapImageToLocal(url) {
    const filename = path.basename(url.split('?')[0]);
    let base = filename.replace(/\.[^.]+$/, '').toLowerCase().replace(/-\d+x\d+$/, '');
    
    for (const img of localImages) {
        let imgBase = img.replace(/\.[^.]+$/, '').toLowerCase();
        const parts = imgBase.split('_');
        if (parts.length > 1) parts.pop();
        let imgBaseNoHash = parts.join('_').replace(/-\d+x\d+$/, '');
        if (imgBaseNoHash === base) {
            return `/assets/images/${img}`;
        }
    }
    for (const img of localImages) {
        let imgBase = img.replace(/\.[^.]+$/, '').toLowerCase();
        if (imgBase.includes(base) || base.includes(imgBase.split('_')[0])) {
            return `/assets/images/${img}`;
        }
    }
    return null;
}

function cleanHref(href) {
    if (href.startsWith('https://giacong.vn')) {
        let route = href.substring('https://giacong.vn'.length);
        if (route === '' || route === '/') return '/';
        if (route.endsWith('/')) route = route.slice(0, -1);
        try {
            route = decodeURIComponent(route);
        } catch (e) {}
        return route.startsWith('/') ? route : '/' + route;
    }
    return href;
}

function cleanAllContent(content) {
    let cleaned = content.replace(/\.\.\/assets\//g, '/assets/');
    cleaned = cleaned.replace(/href="(https:\/\/giacong\.vn[^"]*)"/gi, (match, url) => {
        return `href="${cleanHref(url)}"`;
    });
    cleaned = cleaned.replace(/<script\s+([^>]*src="([^"]+)"[^>]*)>/gi, (match, attrs, src) => {
        if (src.startsWith('http') || src.includes('wp-content') || src.includes('wp-includes')) {
            if (src.includes('googletagmanager.com')) return match;
            const localPath = mapUrlToLocalJS(src);
            if (localPath) return `<script ${attrs.replace(src, localPath)}>`;
        }
        return match;
    });
    cleaned = cleaned.replace(/<img\s+([^>]*src="([^"]+)"[^>]*)>/gi, (match, attrs, src) => {
        if (src.startsWith('http') || src.includes('wp-content')) {
            const localPath = mapImageToLocal(src);
            if (localPath) return `<img ${attrs.replace(src, localPath)}>`;
        }
        return match;
    });
    cleaned = cleaned.replace(/https:\/\/giacong\.vn\/wp-content\/themes\/flatsome\/assets\/css\/icons\/fl-icons\.([a-z0-9?=#\-]+)/gi, (match, extAndQuery) => {
        const ext = extAndQuery.split(/[?#]/)[0];
        const suffix = extAndQuery.substring(ext.length);
        return `/assets/fonts/icons.${ext}${suffix}`;
    });
    return cleaned;
}

const bodyStartTagIndex = content.indexOf('<body');
const headerStartTagIndex = content.indexOf('<header id="header"');
const headerEndTagIndex = content.indexOf('</header>', headerStartTagIndex) + 9;
const footerStartTagIndex = content.indexOf('<footer id="footer"');
const footerEndTagIndex = content.indexOf('</footer>', footerStartTagIndex) + 9;

if (bodyStartTagIndex !== -1 && headerStartTagIndex !== -1 && footerStartTagIndex !== -1) {
    const preHeader = cleanAllContent(content.substring(bodyStartTagIndex, headerStartTagIndex));
    const body = cleanAllContent(content.substring(headerEndTagIndex, footerStartTagIndex));
    const postFooter = cleanAllContent(content.substring(footerEndTagIndex));

    const pageContent = [
        "<%- include('../partials/head') %>",
        preHeader,
        "<%- include('../partials/header') %>",
        body,
        "<%- include('../partials/footer') %>",
        postFooter
    ].join('\n');

    fs.writeFileSync(searchPath, pageContent, 'utf8');
    console.log('Successfully converted search.ejs to EJS partials.');
} else {
    console.log('Error: search.ejs has non-standard layout!');
}
