const fs = require('fs');
const path = require('path');

const headerPath = path.join(__dirname, '..', 'views', 'partials', 'header_raw.ejs');
const header = fs.readFileSync(headerPath, 'utf8');

const hrefRegex = /href="([^"]+)"/gi;
let match;
const links = new Set();
while ((match = hrefRegex.exec(header)) !== null) {
    links.add(match[1]);
}

console.log('--- Links in header ---');
links.forEach(l => console.log(l));
