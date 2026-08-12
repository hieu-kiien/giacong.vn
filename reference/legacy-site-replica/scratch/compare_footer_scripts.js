const fs = require('fs');
const path = require('path');

const interactive = fs.readFileSync(path.join(__dirname, '..', 'html', 'home_interactive.html'), 'utf8');
const footerEndIndex = interactive.indexOf('</footer>') + 9;
const postFooter = interactive.substring(footerEndIndex);

const scriptRegex = /<script\s+[^>]*src="([^"]+)"[^>]*>/gi;
let match;
const scripts = [];
while ((match = scriptRegex.exec(postFooter)) !== null) {
    scripts.push(match[1]);
}

console.log('--- Scripts at bottom of home_interactive.html ---');
scripts.forEach(s => console.log(s));
