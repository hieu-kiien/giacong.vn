const fs = require('fs');
const path = require('path');

const headerPath = path.join(__dirname, '..', 'views', 'partials', 'header_raw.ejs');
const header = fs.readFileSync(headerPath, 'utf8');

const imgRegex = /<img\s+[^>]*src="([^"]+)"[^>]*>/gi;
let match;
while ((match = imgRegex.exec(header)) !== null) {
    console.log(`Image src: ${match[1]}`);
    if (match[0].includes('class="logo')) {
        console.log(`  This is likely a logo image tag: ${match[0]}`);
    }
}
