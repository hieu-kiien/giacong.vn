const fs = require('fs');
const path = require('path');

const searchPath = path.join(__dirname, '..', 'views', 'pages', 'search.ejs');
const content = fs.readFileSync(searchPath, 'utf8');

// Find EJS tags
const regex = /<%.*?%>/g;
let match;
console.log('--- EJS tags found in search.ejs ---');
while ((match = regex.exec(content)) !== null) {
    console.log(match[0]);
}
