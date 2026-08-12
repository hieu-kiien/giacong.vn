const fs = require('fs');
const path = require('path');

const interactive = fs.readFileSync(path.join(__dirname, '..', 'html', 'home_interactive.html'), 'utf8');
const headMatch = interactive.match(/<head>([\s\S]*?)<\/head>/i)[1];
const scripts = [];
const links = [];

const scriptRegex = /<script\s+[^>]*src="([^"]+)"[^>]*>/gi;
let match;
while ((match = scriptRegex.exec(headMatch)) !== null) {
    scripts.push(match[1]);
}

const linkRegex = /<link\s+[^>]*href="([^"]+)"[^>]*>/gi;
while ((match = linkRegex.exec(headMatch)) !== null) {
    links.push(match[1]);
}

console.log('--- Scripts in home_interactive.html head ---');
scripts.forEach(s => console.log(s));

console.log('\n--- Links in home_interactive.html head ---');
links.forEach(l => console.log(l));
