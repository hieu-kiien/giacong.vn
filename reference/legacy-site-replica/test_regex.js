const fs = require('fs');
const path = require('path');

const ejsPath = path.join(__dirname, 'frontend/src/data/pages/home.ejs');
const html = fs.readFileSync(ejsPath, 'utf8');

const headerMatch = html.match(/<%- include\(['"]\.\.\/partials\/header['"]\)\s*%>/);
const footerMatch = html.match(/<%- include\(['"]\.\.\/partials\/footer['"]\)\s*%>/);

console.log('Header match:', headerMatch ? { index: headerMatch.index, text: headerMatch[0] } : 'null');
console.log('Footer match:', footerMatch ? { index: footerMatch.index, text: footerMatch[0] } : 'null');
