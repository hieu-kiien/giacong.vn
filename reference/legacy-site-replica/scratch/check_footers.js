const fs = require('fs');
const path = require('path');

const htmlDir = path.join(__dirname, '..', 'html');
const files = fs.readdirSync(htmlDir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const filePath = path.join(htmlDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    const footerStart = content.indexOf('<footer id="footer"');
    if (footerStart === -1) {
        console.log(`File ${file} does not contain '<footer id="footer"'`);
    } else {
        const footerEnd = content.indexOf('</footer>', footerStart);
        // check if there's any other footer tags
        const count = (content.match(/<footer id="footer"/g) || []).length;
        if (count > 1) {
            console.log(`File ${file} has multiple '<footer id="footer"' tags: ${count}`);
        }
    }
});
console.log('Done checking footers.');
