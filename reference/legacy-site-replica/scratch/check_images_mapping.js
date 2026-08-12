const fs = require('fs');
const path = require('path');

const htmlDir = path.join(__dirname, '..', 'html');
const files = fs.readdirSync(htmlDir).filter(f => f.endsWith('.html'));
const imagesDir = path.join(__dirname, '..', 'assets', 'images');
const localImages = fs.readdirSync(imagesDir);

const wpImages = new Set();
const unmappedWpImages = new Set();

files.forEach(file => {
    const filePath = path.join(htmlDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    const regex = /src="(https:\/\/giacong\.vn\/wp-content\/uploads\/[^"]+)"/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        wpImages.add(match[1]);
    }
});

wpImages.forEach(url => {
    const filename = path.basename(url.split('?')[0]);
    let base = filename.replace(/\.[^.]+$/, ''); // remove extension
    
    // Strip WordPress thumbnail sizes: e.g. -300x200
    base = base.replace(/-\d+x\d+$/, '');

    let found = false;
    for (const img of localImages) {
        const imgParts = img.split('_');
        if (imgParts.length > 1) {
            imgParts.pop(); // remove hash
        }
        const imgBaseClean = imgParts.join('_');
        if (imgBaseClean === base) {
            found = true;
            break;
        }
    }
    if (!found) {
        unmappedWpImages.add(url);
    }
});

console.log(`With WordPress thumbnail suffix stripping:`);
console.log(`Mapped successfully: ${wpImages.size - unmappedWpImages.size}`);
console.log(`Unmapped images count: ${unmappedWpImages.size}`);
if (unmappedWpImages.size > 0) {
    console.log('Unmapped images sample:');
    Array.from(unmappedWpImages).slice(0, 10).forEach(u => console.log(u));
}
