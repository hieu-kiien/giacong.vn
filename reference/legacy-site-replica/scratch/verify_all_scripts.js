const fs = require('fs');
const path = require('path');

const htmlDir = path.join(__dirname, '..', 'html');
const files = fs.readdirSync(htmlDir).filter(f => f.endsWith('.html'));
const jsFiles = fs.readdirSync(path.join(__dirname, '..', 'assets', 'js'));

const remoteScripts = new Set();
const unmappedScripts = new Set();

files.forEach(file => {
    const filePath = path.join(htmlDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    const regex = /<script\s+[^>]*src="([^"]+)"[^>]*>/gi;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const src = match[1];
        if (src.startsWith('http') || src.includes('wp-content') || src.includes('wp-includes')) {
            remoteScripts.add(src);
        }
    }
});

function mapUrlToLocal(url) {
    let cleanUrl = url.split('?')[0];
    if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);
    
    const filename = path.basename(cleanUrl);
    const base = filename.replace(/\.js$/, '');
    const normalizedBase = base.toLowerCase().replace(/[\.\-]/g, '_');
    
    if (normalizedBase === 'onesignalsdk_page') {
        return 'OneSignalSDK_page_7da17e76.js';
    }
    if (normalizedBase === 'onesignalsdk_page_es6') {
        return 'OneSignalSDK_page_es6_ef86d105.js';
    }
    if (normalizedBase === 'sdk') {
        return 'sdk_06b0e4e0.js';
    }
    if (filename === 'index.js') {
        if (url.includes('/swv/')) {
            return 'index_ce3687a7.js';
        } else {
            return 'index_49a6d269.js';
        }
    }

    for (const jsFile of jsFiles) {
        const parts = jsFile.replace(/\.js$/, '').split('_');
        if (parts.length > 1) {
            parts.pop(); // remove hash
        }
        const jsBaseClean = parts.join('_').toLowerCase().replace(/[\.\-]/g, '_');
        if (jsBaseClean === normalizedBase) {
            return jsFile;
        }
    }
    
    return null;
}

console.log(`Found ${remoteScripts.size} unique remote scripts across all files.`);
remoteScripts.forEach(src => {
    const local = mapUrlToLocal(src);
    if (!local) {
        unmappedScripts.add(src);
    }
});

console.log(`Successfully mapped: ${remoteScripts.size - unmappedScripts.size}`);
console.log(`Unmapped scripts count: ${unmappedScripts.size}`);
unmappedScripts.forEach(u => console.log(`  Unmapped: ${u}`));
