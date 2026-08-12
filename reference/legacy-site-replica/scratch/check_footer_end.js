const fs = require('fs');
const path = require('path');

const homePath = path.join(__dirname, '..', 'html', 'home.html');
const content = fs.readFileSync(homePath, 'utf8');

const footerEnd = content.indexOf('</footer>');
if (footerEnd !== -1) {
    console.log('After footer:');
    console.log(content.substring(footerEnd + 9));
}
