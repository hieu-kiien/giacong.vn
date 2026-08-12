const fs = require('fs');
const path = require('path');

const htmlDir = path.join(__dirname, '..', 'html');
const files = fs.readdirSync(htmlDir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const filePath = path.join(htmlDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    const footerEndIndex = content.indexOf('</footer>') + 9;
    if (footerEndIndex !== -1 && footerEndIndex < content.length) {
        const postFooter = content.substring(footerEndIndex);
        console.log(`${file}: post-footer length = ${postFooter.length}`);
    } else {
        console.log(`${file}: no footer end index`);
    }
});
