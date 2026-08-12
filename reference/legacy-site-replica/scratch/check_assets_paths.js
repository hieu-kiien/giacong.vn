const fs = require('fs');
const path = require('path');

const htmlDir = path.join(__dirname, '..', 'html');
const files = fs.readdirSync(htmlDir).filter(f => f.endsWith('.html'));

const assetPatterns = new Set();
const remoteUrls = new Set();

files.forEach(file => {
    const filePath = path.join(htmlDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Find all src="..." and href="..."
    const regex = /(?:src|href)="([^"]+)"/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const val = match[1];
        if (val.includes('assets/')) {
            assetPatterns.add(val);
        } else if (val.startsWith('http') && val.includes('giacong.vn')) {
            remoteUrls.add(val);
        } else if (val.includes('wp-content') || val.includes('wp-includes')) {
            assetPatterns.add(val);
        }
    }
});

console.log('--- ASSET PATHS FOUND (Sample 20) ---');
Array.from(assetPatterns).slice(0, 20).forEach(p => console.log(p));

console.log('\n--- REMOTE GIACONG.VN URLS FOUND (Sample 20) ---');
Array.from(remoteUrls).slice(0, 20).forEach(u => console.log(u));
